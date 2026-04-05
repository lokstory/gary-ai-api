INSERT INTO public.admins (username, password_hash, name, role, enabled)
VALUES ('admin',
        'secret',
        'Admin',
        'SUPER_ADMIN',
        TRUE);

INSERT INTO public.categories (code, name, enabled)
VALUES ('portrait', 'Portrait', TRUE);

INSERT INTO public.categories (code, name, enabled)
VALUES ('video.template', 'Video Template', TRUE);

INSERT INTO public.prompts (name, description, media_type, category_id, price, enabled, bonus_credit)
VALUES ('Cinematic Portrait Lighting Pack',
        'A professionally engineered AI prompt pack for generating cinematic portrait lighting. Includes 10+ style variations optimized for Firefly, Midjourney, and Stable Diffusion.',
        'IMAGE', 1, 1500, TRUE, 10);
INSERT INTO public.prompts (name, description, media_type, category_id, price, enabled, bonus_credit)
VALUES ('Cinematic Portrait Lighting Pack',
        'A professionally engineered AI prompt pack for generating cinematic portrait lighting. Includes 10+ style variations optimized for Firefly, Midjourney, and Stable Diffusion.',
        'VIDEO', 2, 2000, TRUE, 0);

INSERT INTO public.labels (code, name, enabled)
VALUES ('ai.prompt', 'AI Prompt', TRUE);

INSERT INTO public.labels (code, name, enabled)
VALUES ('instant.download', 'Instant Download', TRUE);

INSERT INTO public.prompt_labels (prompt_id, label_id)
VALUES (1, 1);
INSERT INTO public.prompt_labels (prompt_id, label_id)
VALUES (1, 2);
INSERT INTO public.prompt_labels (prompt_id, label_id)
VALUES (2, 1);


INSERT INTO public.files (ref_table, ref_id, category, file_type, bucket, url, position)
VALUES ('prompts', 1, 'COVER', 'IMAGE', 'dev-gary-public', '1-1.jpg', 0),
       ('prompts', 1, 'MEDIA', 'IMAGE', 'dev-gary-public', '1-2.jpg', 1),
       ('prompts', 1, 'MEDIA', 'IMAGE', 'dev-gary-public', '1-3.jpg', 2)
;

INSERT INTO public.files (ref_table, ref_id, category, file_type, bucket, url, parent_id)
VALUES ('prompts', 1, 'THUMBNAIL', 'IMAGE', 'dev-gary-public', '1-1.jpg', 1),
       ('prompts', 1, 'THUMBNAIL', 'IMAGE', 'dev-gary-public', '1-2.jpg', 2),
       ('prompts', 1, 'THUMBNAIL', 'IMAGE', 'dev-gary-public', '1-3.jpg', 3)
;

INSERT INTO public.files (ref_table, ref_id, category, file_type, bucket, url, position)
VALUES ('prompts', 2, 'COVER', 'VIDEO', 'dev-gary-public', '2.mp4', 0);


INSERT INTO public.files (ref_table, ref_id, category, file_type, bucket, url, position)
VALUES ('prompts', 1, 'DOWNLOAD', 'PDF', 'dev-gary-private', '1.pdf', 0);

INSERT INTO public.files (ref_table, ref_id, category, file_type, bucket, url, position)
VALUES ('prompts', 2, 'DOWNLOAD', 'PDF', 'dev-gary-private', '2.pdf', 0);


