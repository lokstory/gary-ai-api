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
       ('prompts', 1, 'IMAGE', 'dev-gary-public', 'https://dev-gary-public.s3.ap-east-2.amazonaws.com/1-3.jpg', 2),
       ('prompts', 1, 'PDF', 'dev-gary-public', 'https://dev-gary-public.s3.ap-east-2.amazonaws.com/1-3.jpg', 2)
;

INSERT INTO public.files (ref_table, ref_id, file_type, bucket, url, position)
VALUES ('prompts', 2, 'VIDEO', 'dev-gary-public', 'https://dev-gary-public.s3.ap-east-2.amazonaws.com/2.mp4', 0);