# DVCQG Detail Gateway – Vercel

Gateway mỏng để Google Apps Script gọi API chi tiết TTHC chính thức qua một egress khác.

## Deploy
1. Import thư mục/repo này vào Vercel.
2. Tạo Environment Variable `GATEWAY_SHARED_SECRET` với một chuỗi bí mật dài.
3. Deploy.
4. Kiểm tra `GET /api/health`.
5. Apps Script dùng `POST /api/dvcqg-detail`, body `{"id":"<UUID>"}`, header `x-gateway-key`.

Không commit hoặc chia sẻ giá trị secret.
