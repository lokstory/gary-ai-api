INSERT INTO public.admins (username, password_hash, name, role, enabled)
VALUES ('admin',
        'secret',
        'Admin',
        'SUPER_ADMIN',
        TRUE);

INSERT INTO public.prompts (name, description, price, enabled, bonus_credit)
VALUES ('Cinematic Portrait Lighting Pack',
        'A professionally engineered AI prompt pack for generating cinematic portrait lighting. Includes 10+ style variations optimized for Firefly, Midjourney, and Stable Diffusion.',
        1500, TRUE, 10);
INSERT INTO public.prompts (name, description, price, enabled, bonus_credit)
VALUES ('Cinematic Portrait Lighting Pack',
        'A professionally engineered AI prompt pack for generating cinematic portrait lighting. Includes 10+ style variations optimized for Firefly, Midjourney, and Stable Diffusion.',
        2000, TRUE, 0);


INSERT INTO public.files (ref_table, ref_id, file_type, bucket, url, position)
VALUES ('prompts', 1, 'IMAGE', 'dev-gary-public', 'https://dev-gary-public.s3.ap-east-2.amazonaws.com/1-1.jpg', 0),
       ('prompts', 1, 'IMAGE', 'dev-gary-public', 'https://dev-gary-public.s3.ap-east-2.amazonaws.com/1-2.jpg', 1),
       ('prompts', 1, 'IMAGE', 'dev-gary-public', 'https://dev-gary-public.s3.ap-east-2.amazonaws.com/1-3.jpg', 2)
;

INSERT INTO public.files (ref_table, ref_id, file_type, bucket, url, position)
VALUES ('prompts', 2, 'VIDEO', 'dev-gary-public', 'https://dev-gary-public.s3.ap-east-2.amazonaws.com/2.mp4', 0);


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


