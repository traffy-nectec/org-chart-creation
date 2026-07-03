const db = require('./public/raw_database.json');
const queries = [
  {p: "สกลนคร", a: "กุสุมาลย์", t: "โพธิไพศาล"},
  {p: "สตูล", a: "ควนกาหลง", t: "อุใดเจริญ"},
  {p: "น่าน", a: "เมืองน่าน", t: "บ่อสวก"},
  {p: "มหาสารคาม", a: "ยางสีสุราช", t: "สร้างแซ่ง"},
  {p: "ร้อยเอ็ด", a: "เมืองร้อยเอ็ด", t: "ปอภาร"},
  {p: "เชียงใหม่", a: "อมก๋อย", t: "แม่หลอง"},
  {p: "เชียงใหม่", a: "แม่วาง", t: "ทุ่งปี๊"},
  {p: "กรุงเทพมหานคร", a: "พญาไท", t: "พญาไท"},
  {p: "แพร่", a: "เมืองแพร่", t: "วังหงส์"},
  {p: "หนองคาย", a: "เมืองหนองคาย", t: "โพนสว่าง"}
];

queries.forEach(q => {
  const amphoeDb = db.filter(r => r.province === q.p && r.amphoe === q.a);
  if(amphoeDb.length > 0) {
    console.log(`\nจังหวัด ${q.p} อำเภอ ${q.a} มีตำบลดังนี้:`);
    console.log(amphoeDb.map(r => r.district).join(', '));
  } else {
    console.log(`\nไม่พบอำเภอ ${q.a} จ.${q.p}`);
  }
});
