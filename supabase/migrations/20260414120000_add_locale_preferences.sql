alter table public.businesses
  add column if not exists default_language text not null default 'en',
  add column if not exists default_locale text not null default 'en-NG';

alter table public.profiles
  add column if not exists language text,
  add column if not exists locale text;

update public.businesses
set
  default_language = coalesce(default_language, 'en'),
  default_locale = coalesce(default_locale, 'en-NG');

alter table public.businesses
  drop constraint if exists businesses_default_language_check,
  drop constraint if exists businesses_default_locale_check,
  add constraint businesses_default_language_check check (default_language in ('en', 'fr')),
  add constraint businesses_default_locale_check check (default_locale in ('en-NG', 'en-US', 'fr-FR'));

alter table public.profiles
  drop constraint if exists profiles_language_check,
  drop constraint if exists profiles_locale_check,
  add constraint profiles_language_check check (language is null or language in ('en', 'fr')),
  add constraint profiles_locale_check check (locale is null or locale in ('en-NG', 'en-US', 'fr-FR'));
