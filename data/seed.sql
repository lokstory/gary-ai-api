
INSERT INTO public.prompts (name, description, price, prompt, enabled) VALUES ('Cinematic Portrait Lighting Pack', 'A professionally engineered AI prompt pack for generating cinematic portrait lighting. Includes 10+ style variations optimized for Firefly, Midjourney, and Stable Diffusion.', 1500, null, true);
INSERT INTO public.prompts (name, description, price, prompt, enabled) VALUES ('Cinematic Portrait Lighting Pack', 'A professionally engineered AI prompt pack for generating cinematic portrait lighting. Includes 10+ style variations optimized for Firefly, Midjourney, and Stable Diffusion.', 2000, null, true);


INSERT INTO public.files (ref_table, ref_id, file_type, url, position)
VALUES
  ('prompts', 1, 'IMAGE', 'https://dev-gary-ai-public.s3.ap-northeast-1.amazonaws.com/1-1.jpg', 0),
  ('prompts', 1, 'IMAGE', 'https://dev-gary-ai-public.s3.ap-northeast-1.amazonaws.com/1-2.jpg', 1),
  ('prompts', 1, 'IMAGE', 'https://dev-gary-ai-public.s3.ap-northeast-1.amazonaws.com/1-3.jpg', 2)
;

INSERT INTO public.files (ref_table, ref_id, file_type, url, position)
VALUES
  ('prompts', 2, 'VIDEO', 'https://dev-gary-ai-public.s3.ap-northeast-1.amazonaws.com/2.mp4', 0);