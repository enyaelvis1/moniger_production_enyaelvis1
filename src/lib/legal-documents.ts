export type LegalSection = {
  title: string;
  content: string;
};

export const termsDocument = {
  title: "Terms of Service",
  updatedAt: "Last updated: March 2026",
  sections: [
    { title: "Acceptance of Terms", content: "By accessing and using moniger.net, you agree to be bound by these Terms of Service. If you do not agree, please do not use our platform." },
    { title: "Description of Service", content: "moniger.net provides a cloud-based financial management platform including invoicing, bill payments, vendor management, and financial reporting. We are not a licensed financial institution - payment processing is provided by supported third-party providers, including Paystack." },
    { title: "Account Responsibilities", content: "You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized access. You must provide accurate and complete information during registration." },
    { title: "Acceptable Use", content: "You agree not to use moniger.net for any illegal activities, money laundering, or fraud. You must comply with all applicable Nigerian laws and regulations, including AML/KYC requirements." },
    { title: "Payment Terms", content: "Our Starter plan is free and activates without paid checkout. Growth and Business require a successful Paystack recurring checkout before the paid subscription becomes active. We do not currently advertise a paid-plan trial. Paid plans are billed monthly or annually in Nigerian Naira (NGN) unless otherwise stated. Cancellation, failed-payment handling, and refunds are subject to the applicable subscription terms and support review." },
    { title: "Data Ownership", content: "You retain ownership of all data you upload to moniger.net. We do not claim any intellectual property rights over your content. You grant us a limited license to process your data as needed to provide our services." },
    { title: "Limitation of Liability", content: "moniger.net is provided 'as is' without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform." },
    { title: "Termination", content: "We may suspend or terminate your account if you violate these terms. You may close your account at any time through Settings. Upon termination, your data will be retained for 30 days before deletion." },
    { title: "Governing Law", content: "These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in the courts of Lagos State." },
  ] satisfies LegalSection[],
};

export const privacyDocument = {
  title: "Privacy Policy",
  updatedAt: "Last updated: March 2026",
  introduction: "At moniger.net, we take your privacy seriously. This policy describes how we collect, use, and protect your personal information.",
  sections: [
    { title: "Information We Collect", content: "We collect information you provide directly, including your name, email address, business information, and financial data necessary to provide our services. We also collect usage data and device information automatically." },
    { title: "How We Use Your Information", content: "We use your information to provide and improve our services, process transactions, send notifications, and ensure the security of your account. We never sell your personal data to third parties." },
    { title: "Data Security", content: "We use security controls including encrypted connections, access boundaries, and multi-factor authentication support to protect your data. Sensitive financial workflows are handled through server-side verification and audited operations." },
    { title: "NDPR Compliance", content: "As a Nigerian platform, we fully comply with the Nigeria Data Protection Regulation (NDPR). You have the right to access, correct, and delete your personal data at any time." },
    { title: "Data Retention", content: "We retain your data for as long as your account is active. Upon account deletion, we remove your personal data within 30 days, except where retention is required by Nigerian financial regulations." },
    { title: "Cookies", content: "We use essential cookies for authentication and session management. We do not use third-party tracking cookies. You can manage cookie preferences in your browser settings." },
    { title: "Changes to This Policy", content: "We may update this policy from time to time. We will notify you of any material changes via email or in-app notification." },
    { title: "Contact Us", content: "If you have questions about this privacy policy, contact us at admin@moniger.net or +234 913 170 1391." },
  ] satisfies LegalSection[],
};
