-- Earlier versions stored the contact details and the first part of the resume text with every parse.
-- They were never read back, so remove them; only the extracted skills and education are kept.
UPDATE resumes SET parsed = parsed - 'email' - 'phone' - 'text_preview' - 'location_text';
