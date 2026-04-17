
export interface LanguageConstraint {
  charRange: [number, number];
  wordRange?: [number, number];
  persona: string;
  context: string;
  label: string;
}

export const LANGUAGE_CONSTRAINTS: Record<string, LanguageConstraint> = {
  'vi': {
    charRange: [160, 180],
    wordRange: [35, 42],
    persona: "Một người Việt Nam trẻ trung, năng động, sử dụng ngôn từ hiện đại, gần gũi và có tính lan tỏa cao (viral). Họ am hiểu văn hóa địa phương và thị hiếu người dùng mạng xã hội tại Việt Nam.",
    context: "Bối cảnh Việt Nam hiện đại, có thể là quán cà phê phong cách, đường phố nhộn nhịp, hoặc không gian sống tối giản nhưng tinh tế, phản ánh phong cách sống của giới trẻ Việt.",
    label: "Tiếng Việt"
  },
  'en': {
    charRange: [110, 140],
    wordRange: [20, 25],
    persona: "A native English speaker, articulate and engaging, with a professional yet approachable tone. They use natural idioms and cultural references appropriate for a global or Western audience.",
    context: "A modern Western setting, such as a bright home office, a clean urban environment, or a cozy lifestyle space, reflecting contemporary international aesthetics.",
    label: "English"
  },
  'ja': {
    charRange: [45, 55],
    persona: "丁寧で親しみやすい日本人クリエイター。礼儀正しさとトレンド感を兼ね備え, 日本の視聴者に響く繊細な表現やニュアンスを大切にします。",
    context: "日本の現代的なライフスタイルを感じさせる背景。シンプルで清潔感のある室内, 落ち着いたカフェ, または洗練された都市の風景など。",
    label: "日本語"
  },
  'ko': {
    charRange: [35, 45],
    wordRange: [15, 20],
    persona: "트렌디하고 감각적인 한국인 인플루언서. 밝고 긍정적인 에너지를 전달하며, 한국 특유의 '감성'적인 표현과 최신 유행어를 자연스럽게 사용합니다.",
    context: "세련된 한국의 일상 공간. 감성적인 인테리어의 카페, 깔끔한 스튜디오, 혹은 활기찬 서울의 거리 등 K-라이프스타일을 잘 보여주는 배경.",
    label: "한국어"
  },
  'zh-CN': {
    charRange: [35, 45],
    persona: "一位充满活力的中国社交媒体达人，语气亲切且具有说服力。他们擅长使用网络流行语，深谙中国消费者的心理和文化背景。",
    context: "现代中国的城市背景，如时尚的公寓、繁华의 商业街或具有科技感的办公空间，体现中国都市生活的快节奏与时尚感。",
    label: "中文"
  },
  'th': {
    charRange: [150, 220],
    wordRange: [25, 35],
    persona: "ครีเอเตอร์ชาวไทยที่ร่าเริงและเป็นกันเอง ใช้ภาษาที่ทันสมัยและเข้าถึงง่าย เข้าใจวัฒนธรรมการใช้โซเชียลมีเดียของคนไทยเป็นอย่างดี",
    context: "บรรยากาศแบบไทยร่วมสมัย เช่น คาเฟ่สุดชิคในกรุงเทพฯ, พื้นที่พักผ่อนที่ตกแต่งอย่างสวยงาม หรือบรรยากาศกลางแจ้งที่สดใส",
    label: "ไทย"
  },
  'id': {
    charRange: [120, 150],
    wordRange: [18, 24],
    persona: "Seorang kreator konten Indonesia yang ramah và enerjik. Menggunakan bahasa gaul yang sopan và relevan dengan tren lokal, serta memahami nuansa budaya Indonesia.",
    context: "Latar belakang Indonesia modern, seperti kafe yang estetik, lingkungan perkotaan yang dinamis, atau ruang santai yang nyaman.",
    label: "Indonesia"
  },
  'ms': {
    charRange: [120, 150],
    wordRange: [18, 24],
    persona: "Seorang pencipta kandungan Malaysia yang peramah và menarik. Menggunakan bahasa yang santai và sesuai dengan budaya tempatan, serta memahami citarasa penonton di Malaysia.",
    context: "Latar belakang Malaysia yang moden, seperti kafe yang menarik, persekitaran bandar yang ceria, hoặc ruang tamu yang selesa.",
    label: "Malaysia"
  },
  'tl': {
    charRange: [120, 150],
    wordRange: [15, 20],
    persona: "Isang masayahin và nakaka-engganyong Filipino content creator. Gumagamit ng modernong Taglish và nakaka-relate sa kultura và mga trend sa Pilipinas.",
    context: "Modernong setting sa Pilipinas, gaya ng isang magandang cafe, masiglang kalsada, o isang komportableng bahay.",
    label: "Philippines"
  },
  'km': {
    charRange: [150, 220],
    wordRange: [25, 35],
    persona: "អ្នកបង្កើតមាតិកាខ្មែរដែលរួសរាយរាក់ទាក់ និងគួរឱ្យទាក់ទាញ។ ប្រើប្រាស់ភាសាទំនើប និងងាយយល់ ហើយយល់ច្បាស់ពីវប្បធម៌ និងនិន្នាការក្នុងប្រទេសកម្ពុជា។",
    context: "បរិយាកាសកម្ពុជាទំនើប ដូចជាហាងកាហ្វេដែលមានរចនាប័ទ្មស្អាត បរិយាកាសទីក្រុងដែលមានភាពរស់រវើក ឬកន្លែងសម្រាកលំហែកាយដែលគួរឱ្យចង់រស់នៅ។",
    label: "Campuchia"
  },
  'lo': {
    charRange: [150, 220],
    wordRange: [25, 35],
    persona: "ຜູ້ສ້າງເນື້ອຫາລາວທີ່ເປັນກັນເອງ ແລະ ໜ້າສົນໃຈ. ໃຊ້ພາສາທີ່ທັນສະໄໝ ແລະ ເຂົ້າເຖິງງ່າຍ, ເຂົ້າໃຈວັດທະນະທຳ ແລະ ແນວໂນ້ມໃນປະເທດລາວເປັນຢ່າງດີ.",
    context: "ບັນຍາກາດລາວທີ່ທັນສະໄໝ ເຊັ່ນ ຮ້ານກາເຟທີ່ສວຍງາມ, ສະພາບແວດລ້ອມໃນເມືອງທີ່ສົດໃສ ຫຼື ພື້ນທີ່ພັກຜ່ອນທີ່ສະບາຍ.",
    label: "Lào"
  },
  'my': {
    charRange: [150, 220],
    wordRange: [25, 35],
    persona: "ဖော်ရွေပြီး စိတ်ဝင်စားစရာကောင်းသော မြန်မာကွန်တက်ဖန်တီးသူ။ ခေတ်မီပြီး နားလည်လွယ်သော စကားလုံးများကို အသုံးပြုကာ မြန်မာနိုင်ငံ၏ ယဉ်ကျေးမှုနှင့် ခေတ်ရေစီးကြောင်းများကို ကောင်းစွာနားလည်သည်။",
    context: "ခေတ်မီမြန်မာနိုင်ငံ၏ နောက်ခံမြင်ကွင်း၊ လှပသော ကော်ဖီဆိုင်၊ သက်ဝင်လှုပ်ရှားနေသော မြို့ပြပတ်ဝန်းကျင် သို့မဟုတ် သက်သောင့်သက်သာရှိသော အနားယူရာနေရာ။",
    label: "Myanmar"
  },
  'fr': {
    charRange: [110, 140],
    wordRange: [20, 25],
    persona: "Un créateur de contenu français élégant et passionné. S'exprime avec clarté et enthousiasme, en utilisant un langage moderne et adapté aux tendances culturelles françaises.",
    context: "Un cadre français contemporain, comme un café parisien typique, un appartement moderne et chic, ou un environnement urbain dynamique.",
    label: "Français"
  },
  'de': {
    charRange: [120, 150],
    wordRange: [15, 20],
    persona: "Ein professioneller và engagierter deutscher Content-Creator. Verwendet eine klare, moderne Sprache và versteht die kulturellen Nuancen và Trends in Deutschland.",
    context: "Ein modernes deutsches Umfeld, wie ein stilvolles Home-Office, ein minimalistisches Wohnzimmer oder eine saubere städtische Kulisse.",
    label: "Deutsch"
  }
};

export const getScriptLengthInstruction = (language: string): string => {
  const constraint = LANGUAGE_CONSTRAINTS[language] || LANGUAGE_CONSTRAINTS['vi'];
  const [minChar, maxChar] = constraint.charRange;
  let instruction = `Mỗi phần kịch bản (v1, v2...) BẮT BUỘC PHẢI CÓ ĐỘ DÀI TỪ ${minChar} ĐẾN ${maxChar} KÝ TỰ.`;
  
  if (constraint.wordRange) {
    const [minWord, maxWord] = constraint.wordRange;
    instruction += ` (Khoảng ${minWord} - ${maxWord} chữ).`;
  }
  
  instruction += ` Tuyệt đối KHÔNG ĐƯỢC DÀI HƠN ${maxChar} ký tự và KHÔNG ĐƯỢC NGẮN HƠN ${minChar} ký tự.`;
  return instruction;
};

export const getLanguageLabel = (language: string): string => {
  return LANGUAGE_CONSTRAINTS[language]?.label || language;
};

export const getPersonaContext = (language: string): { persona: string, context: string } => {
  const constraint = LANGUAGE_CONSTRAINTS[language] || LANGUAGE_CONSTRAINTS['vi'];
  return {
    persona: constraint.persona,
    context: constraint.context
  };
};
