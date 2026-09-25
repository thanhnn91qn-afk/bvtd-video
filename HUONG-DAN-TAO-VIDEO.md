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

### Video xuất ra ở đâu

Mặc định là **`out/` ngay trong dự án** — cùng chỗ với mã nguồn, nên clone repo về máy
nào cũng ra đúng một nơi, không phụ thuộc đường dẫn riêng của máy nào.

Muốn đổi thì có hai cách, theo thứ tự ưu tiên:

1. `--out=<thư mục>` gõ trên dòng lệnh, dùng cho một lần chạy
2. ghi đường dẫn vào `out-dir.txt` ở gốc dự án, dùng lâu dài cho riêng máy đó

`out-dir.txt` không đẩy lên git. **Chỉ tạo file này khi thật sự cần** — đặt nó tức là
máy đó xuất video ra chỗ khác mọi máy còn lại, dễ thành mỗi nơi một kiểu.

Tên file lấy từ `brand.outName` trong kịch bản, không phải từ `--name`:

```jsonc
"brand": { "outName": "clip-vac-xin-cum-16x9" }
```

→ ra `out/clip-vac-xin-cum-16x9.mp4` và `out/clip-vac-xin-cum-16x9-silent.mp4`.
Không khai `outName` thì tên mặc định là `video-<name>.mp4`.

`--name` chỉ đặt tên thư mục cache giọng đọc và cache cảnh, không liên quan tên file
xuất ra. **Hai khổ hình phải dùng `--name` khác nhau** — cache cảnh lưu theo `--name`,
dùng lại tên cũ thì bản 16:9 sẽ ăn phải các cảnh 1080×1920 đã dựng trước đó.

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

### Cách viết nhanh nhất: chỉ ghi nội dung, để bộ đạo diễn lo phần còn lại

```jsonc
{
  "brand": { "outName": "clip-ten-noi-dung-9x16" },
  "scenes": [
    { "id": "s01", "kicker": "…", "headline": "…", "sub": "…", "voice": "…" },
    { "id": "s02", "headline": "…", "chart": [{ "label": "Tim mạch", "value": 3508 }], "voice": "…" },
    { "id": "s03", "headline": "…", "photo": "anh.jpg", "voice": "…" },
    { "id": "s04", "headline": "…", "value": 3508, "voice": "…" },
    { "id": "s05", "headline": "…", "lines": ["…", "…"], "voice": "…" }
  ]
}
```

Không ghi `style`, `art`, `transition` → bộ đạo diễn (`director.mjs`) tự chọn theo nội
dung (xem mục 4b). Muốn ép thì ghi thẳng — **cái gì ghi tay thì không bao giờ bị đè**.

### Đầy đủ các trường

```jsonc
{
  "brand": {
    "outName": "clip-abc-9x16",       // tên file xuất ra
    "music": "nen-nhe.mp3",           // nhạc nền trong assets/music/ — xem mục 5c
    "musicVolume": 0.16
  },
  "scenes": [
    {
      "id": "s01",                    // duy nhất, dùng làm tên file cache
      "style": "auto",                // bỏ trống / "auto" = để đạo diễn chọn; xem mục 4
      "transition": "auto",           // cách VÀO cảnh này; "none" = cắt thẳng; xem mục 4c
      "kicker": "Mở đầu",             // nhãn nhỏ phía trên
      "headline": "Tiêu đề lớn",
      "highlight": ["không thể chủ quan"],  // cụm từ được tô bút dạ (kinetic, caption)
      "sub": "Câu mô tả bên dưới.",
      "photo": "ten-anh.jpg",         // trong assets/photos/ — bỏ trống nếu không có
      "poster": true,                 // ảnh là poster/infographic → hiện trọn, không cắt
      "zoom": "in",                   // "in" | "out" — hướng Ken Burns
      "lines": ["Ý 1", "Ý 2"],        // danh sách hiện lần lượt
      "chart": [{ "label": "…", "value": 3508, "prefix": "hơn ", "suffix": "" }],
      "unit": "người",                // đơn vị chung cho biểu đồ
      "value": 3508,                  // một con số lớn đếm tăng trong vòng tròn (kiểu stat)
      "max": 8000,                    // có thì vòng tròn tô tới value/max
      "prefix": "", "suffix": "%",
      "stat": "200",                  // số phụ kèm tiêu đề ở các kiểu có ảnh
      "statLabel": "Nhãn của số",
      "art": "auto",                  // hình vẽ; xem mục 5
      "wordMs": 260,                  // tốc độ chữ chạy (tự nén lại nếu cảnh ngắn)
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
| `kinetic` | không | Chữ chạy từng từ trên nền chuyển sắc, có thể tô bút dạ cụm từ |
| `plain` | không | Chữ lớn trên nền sáng, kèm số liệu hoặc khối liên hệ |
| `chart` | không | **Biểu đồ cột ngang** từ mảng `chart`, cột mọc lần lượt theo lời đọc, số đếm tăng |
| `stat` | không | **Một con số lớn** đếm tăng trong vòng tròn tự vẽ |
| `logo` | không | Kết clip |

### 9:16 (`build-styles.mjs`)

`cinematic`, `glass`, `caption`, `split`, `wipe`, `card`, `shot` (cần ảnh) ·
`kinetic`, `lines`, `plain`, `chart`, `stat`, `logo` (không cần ảnh).

`shot` dùng cho poster hoặc ảnh chụp màn hình: hiện trọn tấm ảnh, không cắt.

---

### Nguồn gốc `chart` và `stat`

Chuyển thể từ các khối `data-chart`, `animated-bar-chart`, `mk-progress-stat`,
`conic-progress-ring` trong catalog của [HyperFrames](https://github.com/heygen-com/hyperframes)
(Apache-2.0), chạy bằng GSAP. Đã viết lại để đọc số liệu từ kịch bản, tự bố cục theo
khổ dọc/ngang, dùng màu bệnh viện và font có đủ dấu tiếng Việt. Xem `NOTICE`.

---

## 4b. Bộ đạo diễn tự động (`director.mjs`)

Chạy ở đầu mỗi lần dựng, **chỉ điền vào chỗ để trống hoặc ghi `"auto"`**, và in ra từng
quyết định:

```
[dao dien] t02: kieu chart, vao canh bang fade
[dao dien] t05: kieu lines, hinh calendar, vao canh bang dissolve
```

Luật chọn kiểu cảnh, theo thứ tự:

1. Có `chart` (≥ 2 mục) → `chart`. Có `value` là số và không có ảnh → `stat`.
2. Có ảnh là poster / infographic / ảnh chụp màn hình (`"poster": true`, hoặc tên file
   chứa `poster`, `infographic`, `screenshot`, `banner`) → `shot`, hiện trọn không cắt.
3. Có ảnh thường → xoay vòng các kiểu có ảnh, **không để hai cảnh liền nhau cùng kiểu**;
   cảnh đầu ưu tiên `cinematic`; tiêu đề dài quá 10 từ thì bỏ `caption`.
4. Không ảnh: có `lines` → `lines`; có `contact` → `plain`; cảnh cuối → `logo`;
   còn lại xen kẽ `kinetic` và `plain`.

Hình vẽ chỉ gắn khi chính chữ trong cảnh gợi ra một hình, **ưu tiên tiêu đề hơn phần phụ
và các dòng liệt kê**, và không bao giờ dùng một hình hai lần trong cùng clip.

## 4c. Chuyển cảnh

Mặc định giữa mọi cảnh có một lần chuyển 0,4 giây bằng `xfade` của ffmpeg. Bộ đạo diễn
chọn theo ngữ cảnh: vào biểu đồ/số → `fade`; vào poster → `circleopen`; giữa hai ảnh →
`smoothleft`/`smoothright` xen kẽ; từ chữ sang ảnh → `wipeleft`; cảnh kết → `fadewhite`.

Tự chỉ định: `"transition": "slideup"` (tên theo danh sách `xfade` của ffmpeg), hoặc
`"none"` để cắt thẳng. Tắt cả clip: thêm cờ `--no-transitions`.

**Vì sao không mất lời đọc:** mỗi cảnh vốn kết thúc bằng 0,45 giây lặng (`GAP_SEC`). Hai
cảnh chỉ chồng lên nhau trong khoảng lặng đó, lời đọc được cắt đúng bằng phần chồng, nên
hình và tiếng không lệch và không chữ nào bị nuốt. Vì thế thời lượng chuyển cảnh luôn
được giữ dưới `GAP_SEC`.

Khối chuyển cảnh của HyperFrames không dùng được ở đây: chúng cần cả cảnh trước và cảnh
sau trong cùng một trang, còn bộ dựng này dựng từng cảnh thành clip riêng.

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

### Kho hình có sẵn (`art.mjs`) — 38 loại

**Cơ thể, bệnh lý**

| Tên | Hình | Hợp với |
|---|---|---|
| `pulse` | Trái tim + nhịp điện tim | Tim mạch, huyết áp, sức khỏe chung |
| `lungs` | Hai lá phổi + khí quản | Hô hấp, viêm phổi, hen, COPD |
| `brain` | Não + tia xung | Thần kinh sọ não, đột quỵ, tâm thần |
| `nerve` | Nơ-ron + tia đau | Đau thần kinh, zona, kinh lạc |
| `kidney` | Quả thận + niệu quản | Thận, tiết niệu, lọc máu |
| `bone` | Khúc xương + vết nứt | Cơ xương khớp, chấn thương, chỉnh hình |
| `eye` | Con mắt + mống mắt | Mắt, thị lực, giác mạc |
| `tooth` | Chiếc răng | Răng hàm mặt |
| `dna` | Chuỗi xoắn kép | Di truyền, gen, miễn dịch |
| `virus` | Hạt virus có gai | Cúm, lây nhiễm, dịch bệnh |

**Khám, chữa, kỹ thuật**

| Tên | Hình | Hợp với |
|---|---|---|
| `stetho` | Ống nghe | Thăm khám, tư vấn, bác sĩ |
| `syringe` | Bơm kim tiêm | Tiêm chủng, vắc xin |
| `needle` | Kim châm cắm trên da + sóng lan | Châm cứu, điện châm, huyệt đạo |
| `herb` | Lá thuốc + bát sắc + khói | Y học cổ truyền, dược liệu |
| `pill` | Viên nang + viên nén | Thuốc, kê đơn, dược |
| `drop` | Giọt máu + máy đo | Xét nghiệm, đường huyết, lấy máu |
| `micro` | Kính hiển vi | Vi sinh, giải phẫu bệnh, nuôi cấy |
| `xray` | Phim chụp lồng ngực | Chẩn đoán hình ảnh, X-quang, CT |
| `monitor` | Máy theo dõi + đường nhịp | Hồi sức, theo dõi sau thủ thuật |
| `baby` | Em bé trong vòng tay | Sản, nhi, sơ sinh, thai kỳ |
| `care` | Trái tim trên đôi bàn tay | Chăm sóc, đồng hành, giảm nhẹ |

**Phòng bệnh, lối sống**

| Tên | Hình | Hợp với |
|---|---|---|
| `shield` | Khiên + dấu tích | An toàn, bảo vệ, miễn dịch, bảo mật |
| `wash` | Chai sát khuẩn + giọt | Vệ sinh, khử khuẩn, kiểm soát nhiễm khuẩn |
| `water` | Cốc nước + giọt | Bổ sung nước, dinh dưỡng |
| `nosmoke` | Điếu thuốc gạch chéo | Thuốc lá, cai thuốc |

**Số liệu, quy trình, tổ chức**

| Tên | Hình | Hợp với |
|---|---|---|
| `chart` | Cột tăng dần + mũi tên | Kết quả, hiệu quả, tăng trưởng |
| `trend` | Đường xu hướng qua các điểm | Diễn biến theo thời gian, thống kê |
| `donut` | Vòng tròn khuyết một phần | Tỉ lệ, phần trăm, cơ cấu |
| `check` | Ba ô tích lần lượt | Danh sách, nguyên tắc, tiêu chí |
| `doc` | Hồ sơ + vạch quét + kính lúp | Hồ sơ bệnh án, rà soát, tầm soát |
| `clock` | Đồng hồ + kim quay | Thời gian, kéo dài, tiết kiệm giờ |
| `calendar` | Lịch + ngày được đánh dấu | Đặt lịch, khám định kỳ, tiêm nhắc |
| `network` | Nút trung tâm + các nhánh | Hệ thống, tích hợp, mạng nội bộ |
| `team` | Ba người | Đội ngũ, cán bộ, cộng đồng |
| `hospital` | Toà nhà + chữ thập | Bệnh viện, khoa phòng, nhập viện |
| `place` | Ghim bản đồ | Địa chỉ, đường đi, vị trí |
| `phone` | Ống nghe điện thoại + sóng | Hotline, đặt lịch, liên hệ |
| `award` | Huy chương + dải ruy băng | Giải thưởng, thành tích, chất lượng |

### Nhóm hình thứ hai: 748 icon y tế nhập sẵn

Ngoài 38 hình vẽ tay ở trên còn có **[Health Icons](https://github.com/resolvetosavelives/healthicons)**
— 748 icon y tế bản nét, giấy phép CC0 (dùng tự do, không cần ghi nguồn). Gọi bằng
tiền tố `icon:`:

```jsonc
"art": "icon:pregnant-outline"
"art": "icon:nurse-outline"
"art": "icon:ambulance-outline"
```

Tìm tên icon:

```bash
node tools/art-sheet.mjs 6000 icons:vaccine   # lọc theo từ khoá
node tools/art-sheet.mjs 6000 icons:tooth
```

Có sẵn tên cho hầu hết chuyên khoa: `doctor`, `nurse`, `hospital`, `ambulance`,
`microscope`, `xray`, `tooth`, `eye`, `kidneys`, `lungs`, `virus`, `bacteria`,
`syringe-vaccine`, `pregnant`, `elderly`, `old-man`, `old-woman`, `ppe-face-mask`,
`blood-bag`, `blister-pills-round-x4`…

**Ba điều cần biết:**

1. **Không vẽ dần được.** Icon của họ là hình tô đặc, không phải nét kẻ, nên hiệu ứng
   chạy theo nét không áp dụng được. Bù lại, hệ thống tự vẽ một **vòng cung phía sau**
   rồi mới cho icon hiện ra — giữ đúng nhịp "vẽ ra rồi chuyển động" như hình vẽ tay.
2. **`auto` không bao giờ chọn nhóm này.** Đoán trong 748 icon bằng từ khoá sai quá
   nhiều, nên nhóm nhập phải chỉ định tên thẳng.
3. **Kiểu chữ chạy đặt icon ở vị trí khác.** Hình vẽ tay thưa nét nên làm nền mờ sau
   chữ được; icon tô đặc để mờ sau chữ thì thành vệt bẩn, nên nó được đưa lên khoảng
   trống phía trên và tăng độ đậm.

### Xem trước toàn bộ kho hình

```bash
node tools/art-sheet.mjs          # build/art-sheet.png - bảng 38 hình
node tools/art-sheet.mjs 1200     # xem ở mốc 1,2 giây, lúc đang vẽ dở
```

Chạy lệnh này mỗi khi sửa `art.mjs`. **Một hình vẽ ra sai ý chỉ phát hiện được
bằng mắt** — đã có lần motif "dây thần kinh" ra giống cái cây, "rửa tay" ra giống
cục bột, "thận" ra giống khinh khí cầu.

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

## 5b. Không để khung hình đứng yên

Mọi hiệu ứng hiện chữ đều xong trong khoảng **2 giây**, nhưng một câu lời đọc thường
dài **15–20 giây**. Nếu không xử lý, phần còn lại của cảnh là một tấm ảnh tĩnh.

Cảnh có ảnh đã được Ken Burns phóng chậm suốt thời lượng. Cảnh chỉ có chữ thì bốn lớp
sau chạy liên tục, đều tính từ mốc thời gian truyền vào:

| Lớp | Chuyển động |
|---|---|
| Vệt màu nền (`.deco`) | Trôi chậm ngược chiều nhau |
| Nền chuyển sắc (`data-pan`) | Dịch chuyển điểm gốc rất chậm |
| Hình vẽ | Thở nhẹ, nhấp nhô; thêm các vòng lan, kim quay, nét đứt chạy |
| Chữ chạy / danh sách | Sau khi hiện đủ, một đợt sóng rất nhỏ chạy dọc theo các từ, các dòng |

Biên độ cố ý để nhỏ (2–3 px, 1–2% tỉ lệ). Mục đích là khung hình còn thở, không phải
để người xem nhận ra có gì đang động.

**Cạm bẫy khi thêm chuyển động nền:** không bao giờ ghi `transform` lên phần tử mà hàm
hiện chữ cũng ghi — hai bên sẽ ghi đè nhau. Đây đúng là lỗi từng làm khung ảnh tụt
xuống nửa dưới màn hình. Nhắm vào phần tử bao ngoài hoặc phần tử trang trí mà không
hiệu ứng nào đụng tới; nếu buộc phải dùng chung thì gộp vào cùng một vòng lặp.

---

### Hiệu ứng chữ

Chuyển thể từ `per-word-rise` và `marker-highlight` của HyperFrames:

- **Chữ mờ rồi nét dần** — tiêu đề, từng từ ở kiểu chữ chạy, từng dòng ở kiểu danh sách.
- **Tô bút dạ** — ghi `"highlight": ["cụm từ"]`; vạch xanh bạc hà quét qua sau chữ, chữ
  chuyển sang màu đậm như mực. So khớp **cả cụm**, không so từng từ lẻ — so từ lẻ thì
  mọi chữ "không" khác trong câu cũng bị tô theo.
- Tốc độ chữ chạy tự nén lại khi cảnh ngắn, để chữ cuối hiện kịp trước khi chuyển cảnh.

---

## 5c. Nhạc nền

**Không kèm sẵn bản nhạc nào.** Thể lệ các cuộc thi đã cảnh báo về nhạc có bản quyền;
chọn nhạc là việc của người làm clip. Nguồn nhạc miễn phí có thể dùng: YouTube Audio
Library, Pixabay Music — đọc kỹ điều khoản từng bản.

Đặt file vào `assets/music/` rồi khai trong kịch bản:

```jsonc
"brand": { "music": "nen-nhe.mp3", "musicVolume": 0.16 }
```

hoặc cho một lần chạy: `--music=duong/dan/file.mp3`.

Nhạc được lặp cho đủ độ dài, mờ vào 1,5 giây, mờ ra 2,5 giây, và **tự hạ xuống mỗi khi
có lời đọc** (nén theo tín hiệu giọng — "ducking"). Đo thực tế: lúc đang đọc, nhạc thấp
hơn khoảng **14 dB**, và nhích lên lại ở các khoảng ngắt nghỉ.

Bản không tiếng (`-silent.mp4`) không có cả lời lẫn nhạc.

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

## 7b. Bộ kiểm tra kịch bản

Cả hai bộ dựng **tự kiểm tra file kịch bản trước khi gọi TTS**. Một lỗi chính tả tên
kiểu cảnh hay một tấm ảnh không có trên đĩa sẽ dừng ngay trong giây đầu, thay vì làm
hỏng cả lượt dựng năm phút.

**Dừng lại (lỗi):** thiếu `id` / `style` / `voice`, trùng `id`, tên kiểu cảnh không có,
ảnh không tồn tại, **ảnh lặp trong cùng một clip**, kiểu cảnh bắt buộc có ảnh mà bỏ
trống, kiểu `lines` mà thiếu mảng `lines`, tên hình vẽ hoặc tên icon sai.

**Chỉ nhắc (cảnh báo):** `voice` còn sót chữ số, hình vẽ bị lặp, có `stat` mà thiếu
`statLabel`, tiêu đề quá dài dễ tràn khung.

Chạy riêng cho một file bất kỳ:

```bash
node -e "import('./scene-check.mjs').then(async m=>{const {readFileSync}=await import('fs');
const r=m.checkScenes(JSON.parse(readFileSync('scenes-abc.json','utf8')),
{styles:['cinematic','split','glass','caption','wipe','card','shot','lines','kinetic','plain','logo'],root:'.'});
console.log(r)})"
```

> Hai file `scenes.json` và `scenes-khoakham.json` không có trường `style` — chúng
> thuộc hai bộ dựng đời đầu (`build.mjs`, `build-animated.mjs`) không dùng kiểu cảnh.
> Đừng "sửa" chúng theo báo lỗi của bộ kiểm tra này.

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
| Kim đồng hồ quay tại chỗ, lệch khỏi trục | `transform-origin: center` tính theo hộp bao của riêng nét đó. Phải chỉ trục thật bằng `data-origin="x y"` kèm `transform-box: view-box`. |
| Kiểu `shot` ra khung trắng, không thấy ảnh | Engine 9:16 thiếu dòng hiện `#frame` mà bản 16:9 đã có. Khi port kiểu cảnh giữa hai bộ dựng, nhớ port cả dòng trong engine. |
| Số đếm trong biểu đồ kẹt ở "0" suốt clip | `timeline.seek(t)` của GSAP mặc định bỏ qua các hàm callback, mà số đếm được ghi bằng `onUpdate`. Phải tua bằng `seek(t, false)`. |
| Hình virus trên cảnh "Bệnh **không** lây nhiễm" | "lây nhiễm" khớp cả trong "không lây nhiễm" — nghĩa ngược hẳn. Tương tự: "hút thuốc lá" ra viên thuốc, "khen" khớp "hen", "còn gọi là" ra điện thoại. Từ khoá giờ so theo nguyên từ; các câu này được ghim trong `tools/test-art-keywords.mjs`. |
| Chữ cuối chưa kịp hiện đã chuyển cảnh | Tốc độ chữ chạy cố định trong khi cảnh chỉ dài 2,7 giây. Giờ tốc độ tự nén theo độ dài cảnh. |
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
