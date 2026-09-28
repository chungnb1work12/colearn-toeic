# CoLearn TOEIC 450

Website học TOEIC 450 trong 50 ngày: 1.000 từ vựng, 100 bài đọc, ôn tập và lưu tiến độ.

## Chạy trên máy

Mở `index.html`, hoặc chạy máy chủ tĩnh trong thư mục này:

```powershell
py -3 -m http.server 8765
```

Mở <http://localhost:8765/>. Xem [HUONG_DAN.md](./HUONG_DAN.md) để chạy trên GitHub Pages và bật đồng bộ Firebase.

## Đồng bộ tiến độ

Ứng dụng lưu tiến độ cục bộ theo mặc định. Để đồng bộ giữa thiết bị, tạo Firebase Web app, bật Google Authentication và Cloud Firestore, điền cấu hình vào `firebase-config.js`, rồi áp dụng quy tắc trong `firestore.rules`. Hướng dẫn chi tiết nằm trong [HUONG_DAN.md](./HUONG_DAN.md).
