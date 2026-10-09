# DVCQG Detail Gateway v1.1.0

Gateway trung gian cho Apps Script gọi API chi tiết thủ tục hành chính của Cổng DVCQG.

## Điểm mới v1.1.0

- Giữ xác thực bằng `GATEWAY_SHARED_SECRET` / header `x-gateway-key`.
- Gọi API chính thức bằng `fetch` trước.
- Nếu Node `fetch` lỗi mạng cấp thấp (`fetch failed`), tự thử lại bằng `node:https` và ép IPv4.
- Nếu cả hai cách đều lỗi, phản hồi chẩn đoán an toàn gồm mã lỗi mạng, không trả secret.

## Endpoint

- `GET /api/health`
- `POST /api/dvcqg-detail`

Body:

```json
{"id":"019d2bfd-3fe0-70ac-b9d6-5e9e20d6eef7"}
```

Header bắt buộc:

`x-gateway-key: <GATEWAY_SHARED_SECRET>`
