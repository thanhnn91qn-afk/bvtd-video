# Hướng dẫn tạo video tuyên truyền — Bệnh viện Việt Nam – Thụy Điển Uông Bí

Bộ dựng này biến **một file JSON kịch bản** thành **một file MP4 có lời đọc**, không cần
phần mềm dựng phim. Toàn bộ hình ảnh động là HTML/CSS/SVG do trình duyệt vẽ ra.

---

## 1. Cách hoạt động (đọc 1 phút là đủ)

```
scenes-*.json  ──►  TTS (máy chủ LAN)  ──►  file WAV mỗi cảnh  ──►  đo độ dài thật
                                                                          │
                                                                          ▼
                                            mỗi cảnh = 1 trang HTML tự vẽ
                                                                          │
                            Node tính mốc thời gian từng khung hình ──────┤
                            gọi window.__frame(t) rồi chụp màn hình       │
                                                                          ▼
                                        ffmpeg ghép ảnh → clip → nối → ghép tiếng
```

**Điểm mấu chốt:** độ dài mỗi cảnh **do lời đọc quyết định**, không phải do người viết
đặt. TTS đọc xong bao nhiêu giây thì cảnh dài bấy nhiêu giây cộng 0,45 giây nghỉ. Nhờ
vậy chữ và hình luôn khớp tiếng, không bao giờ có đoạn đứng hình chờ lời đọc.

**Vì sao không dùng CSS animation:** trình dựng chụp từng khung hình rời rạc, sau khi
gọi `window.__frame(t)` để đặt trạng thái. CSS animation chạy theo đồng hồ của trình
duyệt nên sẽ bị đóng băng hoặc lệch. **Mọi chuyển động đều phải tính từ `t` truyền vào.**

---

## 2. Chạy

```bash
node build-16x9.mjs   --scenes=scenes-abc.json --name=abc     # 1920x1080
node build-styles.mjs --scenes=scenes-abc.json --name=abc     # 1080x1920
```

| Cờ | Tác dụng |
|---|---|
| `--stills` | Chỉ xuất ảnh tĩnh mỗi cảnh vào `build/stills16/` (16:9) hoặc `build/stills/` (9:16). **Khoảng 40 giây**, không gọi TTS. |
| `--force` | Bỏ qua cache, dựng lại tất cả. |

Kết quả: `out/video-<name>.mp4` (có tiếng) và `out/video-<name>-silent.mp4` (không tiếng).

### Quy trình chuẩn — đừng bỏ bước

1. Viết `scenes-*.json`.
2. Chạy `--stills` (~40 giây) → **mở ảnh ra xem** bố cục, chữ có tràn không, ảnh có đúng nội dung không.
3. Sửa, chạy lại `--stills` cho tới khi ưng.
4. Bỏ `--stills`, dựng đủ (~3–6 phút).
5. Kiểm tra số: thời lượng, đủ 2 luồng hình + tiếng, đủ số cảnh.
6. Trích vài khung hình giữa clip ra xem trước khi giao.

> Bước 2 tiết kiệm hàng chục phút. Dựng đủ rồi mới phát hiện chữ tràn là mất cả lượt.

---

## 3. Cấu trúc file kịch bản

```jsonc
{
  "brand": { "name": "...", "hotline": "...", "web": "vsh.org.vn" },
  "scenes": [
    {
      "id": "s01",                    // duy nhất, dùng làm tên file cache
      "style": "cinematic",           // xem bảng mục 4
      "kicker": "Mở đầu",             // nhãn nhỏ phía trên
      "headline": "Tiêu đề lớn",
      "sub": "Câu mô tả bên dưới.",
      "photo": "ten-anh.jpg",         // trong assets/photos/ — bỏ trống nếu không có
      "zoom": "in",                   // "in" | "out" — hướng Ken Burns
      "lines": ["Ý 1", "Ý 2"],        // cho style lines / logo
      "stat": "200",                  // số lớn, tự đếm tăng dần
      "statLabel": "Nhãn của số",
      "art": "auto",                  // hình vẽ CSS — xem mục 5
      "wordMs": 260,                  // tốc độ chữ chạy, mặc định 190
      "contact": true,                // hiện khối liên hệ (style plain)
      "hotline": "0988 270 115",
      "address": "...",
      "voice": "Lời đọc..."           // BẮT BUỘC — xem mục 6
    }
  ]
}
```

---

## 4. Các kiểu cảnh

### 16:9 (`build-16x9.mjs`)

| Kiểu | Cần ảnh? | Dùng khi |
|---|---|---|
| `cinematic` | có | Mở đầu, ảnh tràn viền, tiêu đề lớn |
| `split` | có | Ảnh một nửa, khối màu mang chữ một nửa |
| `glass` | có | Bảng kính mờ nổi trên ảnh |
| `caption` | có | Chữ chạy từng từ đè lên ảnh |
| `wipe` | có | Ảnh trượt lộ dần từ trái sang |
| `card` | có | Thẻ trắng nổi trên ảnh |
| `shot` | có | **Ảnh chụp màn hình** — hiện trọn, không bao giờ cắt |
| `lines` | tuỳ | Danh sách hiện lần lượt; có ảnh, có hình vẽ, hoặc căn giữa |
| `kinetic` | không | Chữ chạy từng từ trên nền chuyển sắc |
| `plain` | không | Chữ lớn trên nền sáng, kèm số liệu hoặc khối liên hệ |
| `logo` | không | Kết clip |

### 9:16 (`build-styles.mjs`)

`cinematic`, `glass`, `caption`, `split`, `wipe`, `card` (cần ảnh) ·
`kinetic`, `lines`, `plain`, `logo` (không cần ảnh).

---

## 5. Hình vẽ CSS/SVG cho cảnh không có ảnh

Khi một cảnh không có ảnh phù hợp, thay vì để trống hoặc — tệ hơn — nhét đại một tấm
ảnh không đúng nội dung, hãy cho nó một **hình vẽ nét** tự vẽ dần rồi chuyển động nhẹ.

Khai báo trong cảnh:

```jsonc
"art": "nerve"     // chỉ định thẳng
"art": "auto"      // để hệ thống tự đoán theo từ khoá trong cảnh
"art": "none"      // không vẽ gì (hoặc bỏ hẳn trường này)
```

### Kho hình có sẵn (`art.mjs`)

| Tên | Hình | Hợp với nội dung |
|---|---|---|
| `pulse` | Trái tim + nhịp điện tim | Tim mạch, huyết áp, sức khỏe chung |
| `shield` | Khiên + dấu tích | An toàn, bảo mật, miễn dịch, đúng quy định |
| `nerve` | Tế bào thần kinh + tia đau | Đau thần kinh, zona, kinh lạc |
| `needle` | Kim châm + vòng lan toả | Châm cứu, điện châm, huyệt đạo |
| `drop` | Giọt máu + que thử + cột số | Xét nghiệm, đường huyết, lấy máu |
| `clock` | Đồng hồ + kim quay | Thời gian, kéo dài, chờ đợi, tiết kiệm giờ |
| `check` | Ba ô tích lần lượt | Danh sách, nguyên tắc, tiêu chí, khuyến cáo |
| `chart` | Cột tăng dần + mũi tên | Kết quả, hiệu quả, tỉ lệ, tăng trưởng |
| `doc` | Hồ sơ + vạch quét + kính lúp | Hồ sơ bệnh án, rà soát, tầm soát |
| `herb` | Lá thuốc + bát sắc + khói | Thuốc, dược liệu, y học cổ truyền |
| `network` | Nút trung tâm + các nhánh | Hệ thống, tích hợp, mạng nội bộ, kinh lạc |

### Quy tắc dùng

- **Không bắt buộc.** Cảnh nào không có hình nào hợp thì để trống — `auto` cố tình trả về
  *không có gì* khi không khớp từ khoá. Một hình sai nội dung còn tệ hơn một nửa khung trống.
- **Không lặp motif trong cùng một clip**, y như không lặp ảnh. Trình dựng in cảnh báo
  `[warn] hinh ve "x" lap lai` nếu phát hiện — đừng bỏ qua dòng đó.
- `auto` rất hay chọn trùng nhau (ví dụ ba cảnh cùng ra `nerve`). Chạy `--stills`, xem,
  rồi **chỉ định thẳng** cho từng cảnh là chắc nhất.

### Thêm hình mới

Mở `art.mjs`, thêm một mục vào `ART`. Vẽ trong khung `viewBox="0 0 400 400"`, dùng
`stroke="currentColor"` để hình tự ăn theo màu của cảnh. Gắn thuộc tính cho từng nét:

| Thuộc tính | Ý nghĩa |
|---|---|
| `data-seq="0,1,2..."` | Thứ tự vẽ |
| `data-art="draw"` | Vẽ chạy theo nét — chỉ dùng cho `path`, `line`, `polyline`, `circle` |
| `data-art="pop"` | Phóng to từ tâm |
| `data-art="rise"` | Trượt lên kèm hiện dần |
| `data-art="grow"` | Cao dần từ đáy — dùng cho cột biểu đồ |
| `data-loop="pulse"` | Thở nhẹ liên tục sau khi vẽ xong |
| `data-loop="spin"` | Quay đều |
| `data-loop="dash"` | Nét đứt chạy dọc đường |

Muốn tự nhận diện bằng `auto` thì thêm một dòng vào mảng `AUTO` (từ khoá cụ thể đặt
trước từ khoá chung, vì dòng nào khớp trước sẽ thắng).

Chỉnh nhịp vẽ trong từng cảnh: `artStartMs` (mặc định 300), `artStepMs` (210),
`artDrawMs` (620).

---

## 6. Viết lời đọc cho máy đọc tiếng Việt

Máy đọc **không đọc được chữ số và ký hiệu**. Trong `voice` phải viết thành chữ; trong
`headline` / `sub` / `lines` thì cứ để số cho người xem đọc.

| Trên màn hình | Trong `voice` |
|---|---|
| `10 - 20%` | `mười đến hai mươi phần trăm` |
| `5.894 hồ sơ` | `gần sáu nghìn hồ sơ` |
| `2026` | `hai nghìn không trăm hai mươi sáu` |
| `6h30 - 12h` | `sáu giờ ba mươi đến mười hai giờ` |
| `0988 270 115` | `không chín tám tám, hai bảy không, một một năm` |
| `β-hCG` | `bê ta hắc xê giê` |

Thêm:
- Bỏ dấu ngoặc kép, gạch đầu dòng, ký hiệu `·`, `–`, `/` trong `voice`.
- Viết câu ngắn, có dấu phẩy — máy sẽ ngắt nghỉ theo dấu câu.
- Tên riêng nước ngoài viết theo âm Việt (`LM Studio` → `eo em xtu đi ô`) nếu máy đọc sai.

---

## 7. Chọn ảnh

- Ảnh đặt trong `assets/photos/`. Ưu tiên ảnh thật của bệnh viện (lấy trên `vsh.org.vn`,
  ảnh trong bài nằm ở đường dẫn `/pic/QA/images/` hoặc `/pic/News/images/`).
- **Không lặp một ảnh trong cùng một clip.**
- **Ảnh phải đúng nội dung câu đang đọc.** Cảnh nói về nỗi đau của người bệnh mà ghép ảnh
  đang điều trị là sai.
- Cảnh không có ảnh đúng thì **đừng lấy ảnh có người làm nền cho đủ** — dùng hình vẽ
  (mục 5), ảnh toà nhà, hoặc để trống.
- Ảnh chụp màn hình hệ thống thật: **che hết tên, số bệnh án, số thẻ BHYT** trước khi
  đưa vào. Cắt bằng `ffmpeg -vf crop=W:H:X:Y` rồi mở ra xem lại đã sạch chưa.
- Ảnh phối cảnh 3D, ảnh AI: tránh dùng cho clip dự thi hoặc clip có đối chiếu, xác minh.

---

## 8. Kiểm tra trước khi giao

```bash
# thời lượng, độ phân giải, có đủ hình + tiếng chưa
ffprobe -v error -show_entries format=duration \
        -show_entries stream=codec_type,width,height -of default=nw=1 out/video-abc.mp4

# trích khung hình ở giây thứ N để xem tận mắt
ffmpeg -ss 45 -i out/video-abc.mp4 -frames:v 1 build/kiem-tra.png -y
```

Danh sách tự kiểm:

- [ ] Đủ số cảnh, thời lượng hợp lý (clip dự thi: dưới mức trần của thể lệ)
- [ ] Có cả luồng `video` và `audio`
- [ ] Không ảnh nào lặp, không motif nào lặp
- [ ] Ảnh khớp nội dung từng cảnh
- [ ] Không lộ thông tin người bệnh
- [ ] Số liệu, năm tháng đúng — cả trên màn hình lẫn trong lời đọc
- [ ] Chữ không tràn khung, không bị che

---

## 9. Những lỗi đã gặp — đừng lặp lại

| Hiện tượng | Nguyên nhân thật |
|---|---|
| Từ giữa clip chỉ còn tiếng, hình đứng im | Máy chủ TTS trả file WAV nhưng đặt đuôi `.mp3`; công thức tính độ dài theo khung MP3 ra ngắn hơn ~3,5 lần. Đã vá trong `audio-tools.ts`. |
| Clip A lại mang lời đọc của clip B | Cache giọng đọc dùng chung thư mục. Đã tách theo `--name`. Dấu hiệu: hai clip có độ dài từng cảnh giống hệt nhau. |
| Chữ hoặc lớp phủ biến mất hoàn toàn | Ảnh PNG một khung bị lấy mẫu ở `t=0`, lúc đó độ mờ đang bằng 0. Phải dùng `-loop 1 -framerate N -t <dur>`. |
| Khung ảnh tụt xuống nửa dưới, bị cắt | Hàm hiệu ứng ghi đè `transform`, xoá mất `translateY(-50%)` dùng căn giữa. Căn giữa bằng lớp bọc flex, chừa `transform` cho hiệu ứng. |
| Ô số liệu hiện số `0` | `parseStat` từ chối năm (`2026`), nên không có đếm tăng — phải in thẳng giá trị gốc. |
| Ảnh rung giật khi chuyển cảnh | `zoompan` của ffmpeg làm tròn về số nguyên. Đã thay bằng `transform: scale()` đặt theo từng khung hình. |
| Chrome treo vô thời hạn | Hồ sơ Chrome mặc định đang bị trình duyệt của người dùng khoá. Phải dùng `--user-data-dir` riêng. |
| ffmpeg báo thành công nhưng video sai | Chuyện thường. **Luôn trích khung hình ra xem**, đừng tin dòng "Done". |

---

## 10. Cài trên máy khác

Cần: **Node 18+**, **Google Chrome**, **ffmpeg**, và một **máy chủ TTS tiếng Việt**.

```bash
npm install
```

Sửa ba đường dẫn ở đầu `build-16x9.mjs` và `build-styles.mjs` cho khớp máy mới:

```js
const TTS_ENDPOINT = process.env.TTS_ENDPOINT ?? "http://192.168.1.71:8000";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG_BIN = "...";   // thư mục chứa ffmpeg.exe
```

Máy chủ TTS chỉ cần nhận `POST /tts` với JSON `{ "text": "..." }` và trả về dữ liệu WAV.

**Máy ít RAM (dưới 8 GB):** hạ `FPS` xuống 15 và dựng từng clip một, đừng chạy song song —
Chrome và x264 cùng lúc sẽ hết bộ nhớ.
