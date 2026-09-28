# CoLearn — khóa học TOEIC 450 trong 50 ngày

## Nội dung

- Lộ trình 50 ngày, mỗi ngày 20 từ mới.
- 1.000 mục từ vựng có nghĩa tiếng Việt, loại từ và câu ví dụ song ngữ.
- 100 bài đọc tiếng Anh đơn giản, hai bài mỗi ngày; mỗi bài có bản dịch và ba câu hỏi đọc hiểu.
- Có tìm kiếm, phát âm bằng giọng đọc của trình duyệt, đánh dấu từ yêu thích/đã học và lưu tiến độ trên trình duyệt hiện tại.

Lưu ý: một phần từ vựng chưa có ký hiệu phiên âm IPA. Giọng đọc được tổng hợp bởi trình duyệt/thiết bị và có thể khác nhau giữa các máy.

## Chạy trên Windows

1. Chép toàn bộ thư mục `CoLearn` sang máy cần sử dụng.
2. Cài Python 3 nếu máy chưa có. Trên Windows, lệnh `py -3` thường có sẵn sau khi cài.
3. Nhấp phải `Start-CoLearn.ps1` và chọn **Run with PowerShell**. Nếu Windows chặn script, mở PowerShell trong thư mục này và chạy:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\Start-CoLearn.ps1
   ```

4. Trình duyệt mở trang tại `http://127.0.0.1:8765/`. Để dừng máy chủ, quay lại cửa sổ PowerShell và nhấn Enter.

Có thể mở trực tiếp `index.html` bằng cách nhấp đúp; bản này đã gói dữ liệu vào JavaScript để tránh lỗi chặn JSON ở chế độ `file://`. Nếu muốn cách chạy ổn định hơn, dùng `Start-CoLearn.ps1`. Nếu cổng 8765 đang được ứng dụng khác sử dụng, đổi số `8765` trong script sang một cổng khác.

Tiến độ học được lưu trong localStorage của trình duyệt trên từng máy. Sao chép thư mục không tự chuyển tiến độ sang máy khác; bookmark, ngày học và từ đã đánh dấu cần được đồng bộ/xuất riêng nếu muốn mang theo.

## Cấu trúc thư mục

```text
CoLearn/
├── index.html
├── app.js
├── styles.css
├── Start-CoLearn.ps1
├── HUONG_DAN.md
└── data/
    ├── articles.json
    └── vocabulary.json
```

## Đưa website lên mạng

### Phương án A — website công khai (đề xuất nếu nội dung có thể xem bởi mọi người)

1. Tạo repository trên GitHub và chép nội dung thư mục này vào repository.
2. Chọn dịch vụ static hosting, ví dụ GitHub Pages, Netlify hoặc Cloudflare Pages; kết nối repository.
3. Thiết lập publish directory là thư mục chứa `index.html` (ở bản CoLearn này là thư mục gốc), không cần build command.
4. Chạy deploy và kiểm tra URL HTTPS: trang chính, dữ liệu trong `data/`, điện thoại và chức năng phát âm.
5. Mỗi lần cập nhật nội dung, đẩy commit mới để dịch vụ tự triển khai lại.

Trang tĩnh không cần máy chủ ứng dụng riêng. Tuy nhiên, ai có URL đều có thể truy cập; không tải lên thông tin cá nhân hoặc dữ liệu cần bảo mật.

### Phương án B — website riêng tư

Chọn nền tảng có xác thực/giới hạn người xem (chẳng hạn Sites ở chế độ private hoặc hosting có access control). Đưa thư mục web lên, đặt publish directory ở thư mục gốc và cấu hình chỉ tài khoản được phép mới xem. Với Sites, cần tài khoản chủ sở hữu đăng nhập, quyền truy cập kho nguồn và triển khai; giữ chế độ private khi deploy. Kiểm tra bằng tài khoản được cấp quyền và một cửa sổ chưa đăng nhập.

Nếu yêu cầu quyền riêng tư nghiêm ngặt, hãy xác nhận nền tảng bảo vệ cả file HTML và JSON bằng xác thực. Chỉ đặt giao diện trang web sau một màn hình mật khẩu ở phía trình duyệt không bảo vệ dữ liệu thật sự.

### Chọn phương án nào?

- Chọn A nếu bạn muốn gửi liên kết cho mọi người và nội dung không nhạy cảm.
- Chọn B nếu chỉ bạn/nhóm được phép truy cập; cần đăng nhập/quyền xem phù hợp.
- Gói portable hiện tại có thể học offline sau khi chạy máy chủ cục bộ; muốn online thì cần deploy lên một hosting.

