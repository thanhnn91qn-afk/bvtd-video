/**
 * Regression test for the motif keyword table in art.mjs.
 *
 *   node tools/test-art-keywords.mjs
 *
 * Every case here is a sentence that once drew the wrong picture, or a trap of
 * the same kind. `first` is the motif that must come out on top; `not` lists
 * motifs that must not appear among the candidates at all.
 */
import { artCandidates } from "../art.mjs";

const CASES = [
  // "không lây nhiễm" = NON-communicable
  { text: "Bệnh không lây nhiễm - không thể chủ quan", not: ["virus"] },
  { text: "Bệnh truyền nhiễm lây lan nhanh trong cộng đồng", first: "virus" },
  { text: "Phòng bệnh lây nhiễm qua đường hô hấp", first: "virus" },
  // tobacco is not medicine
  { text: "Người hút thuốc lá, sử dụng rượu bia", first: "nosmoke", not: ["pill"] },
  { text: "Không tự ý ngừng thuốc hay đổi liều", first: "pill" },
  { text: "Bài thuốc y học cổ truyền theo từng thể bệnh", first: "herb" },
  // words hiding inside other words
  { text: "Tập thể được khen ngợi vì tận tình", not: ["lungs"] },
  { text: "Người bệnh hen phế quản cần lưu ý", first: "lungs" },
  { text: "Bệnh còn gọi là tiểu đường tuýp 2", first: "drop", not: ["phone"] },
  { text: "Trọng tâm của chương trình năm nay", not: ["hospital"] },
  { text: "Lịch sử hình thành và phát triển", not: ["calendar"] },
  { text: "Trên cơ sở kết quả đạt được", first: "chart", not: ["place"] },
  // generic words that used to pick a picture on their own
  { text: "Giảm đau, phục hồi chức năng, nâng cao chất lượng cuộc sống", not: ["chart", "award"] },
  // plain positives
  { text: "Tiêm vắc xin cúm ngay hôm nay", first: "syringe" },
  { text: "Tiến triển âm thầm trong nhiều năm", first: "clock" },
  { text: "Gọi ngay hotline để đặt lịch khám", first: "calendar" },
  { text: "Đau như điện giật dọc dây thần kinh", first: "nerve" },
  // the headline decides, not one bullet in the list
  { scene: { headline: "Cần khám định kỳ và sàng lọc sớm",
             lines: ["Người cao tuổi", "Người hút thuốc lá"] }, first: "calendar" },
];

let fail = 0;
for (const c of CASES) {
  const got = artCandidates(c.scene || { headline: c.text });
  c.text = c.text || c.scene.headline + " (+ dong liet ke)";
  const errs = [];
  if (c.first && got[0] !== c.first) errs.push(`dau tien phai la ${c.first}`);
  for (const n of c.not || []) if (got.includes(n)) errs.push(`khong duoc co ${n}`);
  if (errs.length) fail++;
  console.log(`${errs.length ? "HONG" : "dat "}  ${c.text.padEnd(62)} -> ${got.join(", ") || "(khong co)"}` +
    (errs.length ? `   <- ${errs.join("; ")}` : ""));
}
console.log(`\n${CASES.length - fail}/${CASES.length} dat`);
process.exit(fail ? 1 : 0);
