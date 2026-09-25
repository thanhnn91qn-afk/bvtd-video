# bvtd-video

Dựng video tuyên truyền cho **Bệnh viện Việt Nam – Thụy Điển Uông Bí** từ một file JSON
kịch bản. Lời đọc do máy chủ TTS tiếng Việt trong mạng nội bộ sinh ra; hình ảnh động
là HTML/CSS/SVG do Chrome vẽ rồi ffmpeg ghép lại. Không cần phần mềm dựng phim.

📖 **[HUONG-DAN-TAO-VIDEO.md](HUONG-DAN-TAO-VIDEO.md) — đọc file này trước.**

## Chạy nhanh

```bash
npm install

# xem thử bố cục, ~40 giây, không gọi TTS
node build-16x9.mjs --scenes=scenes-zona-yhct.json --name=zona --stills

# dựng đủ, ~3-6 phút
node build-16x9.mjs --scenes=scenes-zona-yhct.json --name=zona
```

Ra `out/video-zona.mp4` (có tiếng) và `out/video-zona-silent.mp4` (không tiếng).

Khổ dọc 1080×1920 dùng `build-styles.mjs` với cùng bộ tham số.

## Nội dung

| Đường dẫn | Là gì |
|---|---|
| `build-16x9.mjs` | Bộ dựng ngang 1920×1080 — 13 kiểu cảnh |
| `build-styles.mjs` | Bộ dựng dọc 1080×1920 — 13 kiểu cảnh |
| `director.mjs` | **Bộ đạo diễn**: tự chọn kiểu cảnh, hình vẽ, chuyển cảnh cho chỗ kịch bản để trống |
| `motion.mjs` | Biểu đồ, vòng số đếm (GSAP, chuyển thể từ HyperFrames), hiệu ứng chữ |
| `assemble.mjs` | Nối cảnh có chuyển cảnh, cắt lời đọc cho khớp, trộn nhạc nền có ducking |
| `art.mjs` | 38 hình vẽ nét SVG tự vẽ dần + 748 icon y tế nhập sẵn |
| `scene-check.mjs` | Kiểm tra kịch bản trước khi dựng |
| `scenes-*.json` | Kịch bản từng clip |
| `assets/photos/` | Ảnh dùng trong clip |
| `assets/logo.png` | Logo bệnh viện |
| `build.mjs`, `build-animated.mjs` | Hai bản dựng đời đầu, giữ lại để tham khảo |

## Cần có trên máy

Node 18+ · Google Chrome · ffmpeg · một máy chủ TTS nhận `POST /tts {text}` và trả WAV.

Ba đường dẫn phụ thuộc máy nằm ở đầu hai file `build-*.mjs` — sửa cho khớp trước khi chạy.

## Lưu ý khi làm nội dung y tế

- Ảnh chụp màn hình hệ thống thật phải che hết tên, số bệnh án, số thẻ BHYT của người bệnh.
- Không lặp một ảnh trong cùng một clip; ảnh phải đúng nội dung câu đang đọc.
- Trong trường `voice`, mọi chữ số phải viết thành chữ — máy đọc không đọc được số.

Chi tiết và danh sách lỗi đã gặp: xem [HUONG-DAN-TAO-VIDEO.md](HUONG-DAN-TAO-VIDEO.md).
