import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { logAuditEventSafe } from "@/lib/audit";
import { supabase } from "@/lib/supabase";

const BUCKET = "bill-attachments";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export type BillAttachment = Pick<Tables<"bill_attachments">, "bill_id" | "created_at" | "file_name" | "file_size" | "id" | "mime_type" | "storage_path">;

const attachmentsQueryKey = (businessId: string | undefined, billId: string | undefined) => ["bill-attachments", businessId, billId] as const;

const validateFile = (file: File) => {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Upload a PDF, JPG, PNG, or WEBP vendor invoice.");
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("Vendor invoice files must be smaller than 10 MB.");
  }
};

const safeFileName = (fileName: string) => fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "invoice-file";

const fetchBillAttachments = async (businessId: string, billId: string) => {
  const { data, error } = await supabase
    .from("bill_attachments")
    .select("bill_id, created_at, file_name, file_size, id, mime_type, storage_path")
    .eq("business_id", businessId)
    .eq("bill_id", billId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as BillAttachment[];
};

const uploadBillAttachment = async ({ businessId, billId, file, userId }: { businessId: string; billId: string; file: File; userId: string }) => {
  validateFile(file);

  const storagePath = `${businessId}/${billId}/${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: insertError } = await supabase
    .from("bill_attachments")
    .insert({
      bill_id: billId,
      business_id: businessId,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      uploaded_by: userId,
    })
    .select("bill_id, created_at, file_name, file_size, id, mime_type, storage_path")
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw insertError;
  }

  await logAuditEventSafe({
    action: "bill.attachment_uploaded",
    actorUserId: userId,
    businessId,
    detail: { bill_id: billId, file_name: file.name, file_size: file.size, mime_type: file.type },
    entityId: billId,
    entityType: "bill_attachment",
    summary: `Attachment ${file.name} uploaded to bill`,
  });

  return data as BillAttachment;
};

const removeBillAttachment = async (attachment: BillAttachment, userId: string, businessId: string) => {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
  if (storageError) {
    throw storageError;
  }

  const { error } = await supabase.from("bill_attachments").delete().eq("id", attachment.id);
  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "bill.attachment_removed",
    actorUserId: userId,
    businessId,
    detail: { bill_id: attachment.bill_id, file_name: attachment.file_name, file_size: attachment.file_size, mime_type: attachment.mime_type },
    entityId: attachment.bill_id,
    entityType: "bill_attachment",
    summary: `Attachment ${attachment.file_name} removed from bill`,
  });
};

export const useBillAttachments = (businessId?: string, billId?: string) => {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const query = useQuery({
    enabled: Boolean(businessId && billId),
    queryKey: attachmentsQueryKey(businessId, billId),
    queryFn: () => fetchBillAttachments(businessId!, billId!),
  });

  const upload = useMutation({
    mutationFn: ({ file, userId }: { file: File; userId: string }) => {
      if (!businessId || !billId) throw new Error("Save the bill before uploading an attachment.");
      return uploadBillAttachment({ businessId, billId, file, userId });
    },
    onMutate: () => setUploadProgress(15),
    onSuccess: () => {
      setUploadProgress(100);
      return queryClient.invalidateQueries({ queryKey: attachmentsQueryKey(businessId, billId) });
    },
    onSettled: () => window.setTimeout(() => setUploadProgress(0), 500),
  });

  const remove = useMutation({
    mutationFn: ({ attachment, userId }: { attachment: BillAttachment; userId: string }) => {
      if (!businessId) throw new Error("Workspace is not available.");
      return removeBillAttachment(attachment, userId, businessId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attachmentsQueryKey(businessId, billId) }),
  });

  const createSignedUrl = async (attachment: BillAttachment) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(attachment.storage_path, 300);
    if (error) throw error;
    return data.signedUrl;
  };

  return { ...query, createSignedUrl, remove, upload, uploadProgress } as const;
};
