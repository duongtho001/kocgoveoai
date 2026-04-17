
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getAiClient, callWithAiFallback } from "./keyService";
import { getScriptLengthInstruction, getPersonaContext, getLanguageLabel } from "../utils/languageUtils";

const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const FORBIDDEN_TERMS = `Facebook, Shopee, Lazada, Tiki, Zalo, Sale sốc, Mua ngay, Cam kết, Top 1, Giá rẻ nhất, duy nhất, tri ân.`;

/**
 * Lấy hướng dẫn chi tiết về giọng đọc dựa trên nhãn lựa chọn.
 */
const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const isNorth = voiceLabel.includes("Bắc");
  
  const dialectInstruction = isNorth ? `
    VĂN PHONG MIỀN BẮC (HÀ NỘI):
    - Sử dụng từ đệm: "nhé", "ạ", "thế", "đấy", "vậy", "vâng", "chứ".
    - Cách dùng từ: "không", "vẫn", "thế này".
    - TUYỆT ĐỐI KHÔNG dùng các từ miền Nam như: nha, nè, nghen, thiệt, hông, vầy, bển, trển.
  ` : `
    VĂN PHONG MIỀN NAM (SÀI GÒN):
    - Sử dụng từ đệm: "nha", "nè", "nghen", "hen", "đó", "vầy", "nghen", "ha".
    - Cách dùng từ: "hông" (thay cho không), "thiệt" (thay cho thật), "dễ thương dữ thần", "hết sảy".
    - TUYỆT ĐỐI KHÔNG dùng các từ miền Bắc như: nhé, ạ, thế, đấy, chả, vâng.
  `;

  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "20-40 tuổi, giọng miền Bắc, năng động, nhịp độ nhanh, vui vẻ, tông cao, hào hứng.",
    "Giọng Nam 20-40 tuổi": "20-40 tuổi, giọng miền Nam, năng động, nhịp độ nhanh, vui vẻ, tông cao, hào hứng.",
    "Giọng Bắc 50-60 tuổi": "50-60 tuổi, giọng miền Bắc, giọng trầm, vang, ổn định, uy quyền, đáng tin cậy.",
    "Giọng Nam 50-60 tuổi": "50-60 tuổi, giọng miền Nam, giọng trầm, vang, ổn định, uy quyền, đáng tin cậy.",
    "Giọng Bắc 60-80 tuổi": "60-80 tuổi, giọng miền Bắc, khàn, hào sảng, chân chất, thực tế.",
    "Giọng Nam 60-80 tuổi": "60-80 tuổi, giọng miền Nam, khàn, hào sảng, chân chất, thực tế."
  };
  
  return (mapping[voiceLabel] || voiceLabel) + "\n" + dialectInstruction;
};

/**
 * Lấy hướng dẫn chi tiết về phong cách kịch bản dựa trên ID phong cách.
 */
const getStyleDetailedInstruction = (styleId: string) => {
  switch (styleId) {
    case 'arrogant_invader':
      return `
        CÔNG THỨC: "Kẻ Xâm Nhập Ngạo Mạn" (The Arrogant Invader)
        - Phù hợp: Sản phẩm trị liệu, làm đẹp, diệt côn trùng, diệt khuẩn.
        - Đại diện Phản diện: Một sinh vật gớm ghiếc tàn phá cơ thể/tài sản (Ví dụ: Cục mỡ thừa, Cục mụn viêm, Mảng bám răng, Rệp giường).
        Bố cục 4 giai đoạn:
        1. Khiêu khích (0-5s): Phản diện cười cợt, khoe khoang về sự tàn phá nó đang gây ra. (Ví dụ mụn viêm: "Định nặn tao á? Cứ nặn đi, tao sẽ để lại cái sẹo rỗ chà bá cho mày xem!")
        2. Vô vọng (5-10s): Nhấn mạnh các cách thông thường không có tác dụng. "Mấy cái kem bôi rẻ tiền kia chỉ làm tao béo thêm thôi."
        3. Hoảng loạn vì Khắc tinh (10-20s): Sản phẩm xuất hiện (thường đi kèm hiệu ứng ánh sáng/vũ khí). Phản diện hoảng sợ và tự khai ra USP của sản phẩm. "Khoan! Axit Salicylic 2% công nghệ nano à? Nó đang xuyên qua lớp bã nhờn của tao!"
        4. Bị tiêu diệt & Lời nguyền (20-30s): Phản diện bị tiêu diệt một cách cực đoan (tan chảy, nổ tung, hoặc bị quét sạch không dấu vết). Trước khi biến mất hoàn toàn, nó để lại lời nguyền/lời dặn hậm hực về việc sẽ quay lại báo thù. "Á á! Mày thắng... nhưng tao sẽ quay lại báo thù, tao sẽ tàn phá mày gấp đôi khi mày sơ hở!"
      `;
    case 'stubborn_parasite':
      return `
        CÔNG THỨC: "Kẻ Ăn Bám Lì Lợm" (The Stubborn Parasite)
        - Phù hợp: Sản phẩm tẩy rửa gia dụng, phần mềm diệt virus, dọn rác điện thoại, dịch vụ vệ sinh.
        - Đại diện Phản diện: Một kẻ lười biếng, bẩn thỉu đang chiếm dụng không gian (Ví dụ: Vết dầu mỡ cháy khét trên bếp, Con bọ bụi bặm trong nệm, Tập tin rác làm chậm máy).
        Bố cục 4 giai đoạn:
        1. Hưởng thụ (0-5s): Phản diện đang nằm ườn thoải mái, chê cười nỗ lực của người dùng. (Ví dụ vết dầu mỡ: "Chà nữa đi! Chà đứt tay tao cũng không bong ra đâu, tao bám ở cái bếp này 3 năm rồi.")
        2. Củng cố địa vị (5-10s): Nhấn mạnh sự bám rễ sâu sắc. "Nước rửa chén bình thường tuổi gì đòi rửa trôi tao?"
        3. Bị bóc phốt & Đuổi cổ (10-20s): Xịt sản phẩm vào. Phản diện mất chỗ bám và la hét thông tin sản phẩm. "Cái bọt tuyết gì thế này? Công nghệ enzyme bẻ gãy liên kết dầu mỡ sao? Cứu tao, tao trượt chân rồi!"
        4. Chấp nhận thua cuộc (20-30s): Phản diện bị dọn sạch bong một cách thảm hại, buông lời hậm hực trong tuyệt vọng về việc sẽ quay lại báo thù. "Được rồi tao đi! Nhưng tao sẽ quay lại báo thù, chỉ cần mày lười một chút thôi là tao sẽ bám chặt hơn trước!"
      `;
    case 'secret_saboteur':
      return `
        CÔNG THỨC: "Kẻ Thao Túng Bí Mật" (The Secret Saboteur)
        - Phù hợp: Ứng dụng công nghệ, thực phẩm chức năng (trị mất ngủ, tăng tập trung), khóa học, dịch vụ tài chính.
        - Đại diện Phản diện: Một kẻ giật dây bí mật bên trong đầu/cơ thể người dùng (Ví dụ: Con quỷ chần chừ, Quái vật mất ngủ, Trùm nợ nần).
        Bố cục 4 giai đoạn:
        1. Lật tẩy (0-5s): Phản diện tiết lộ nó chính là nguyên nhân gây ra sự mệt mỏi/thất bại. (Ví dụ quái vật chần chừ: "Mày tưởng mày lướt điện thoại 5 phút thôi à? Là tao đang giữ tay mày lại đấy!")
        2. Mô tả cái bẫy (5-10s): Kể lại vòng lặp thói quen xấu của người dùng. "Cứ bảo 'để mai làm', và tao thích cái chữ 'mai' đó của mày."
        3. Lỗi hệ thống vì Giải pháp (10-20s): Người dùng kích hoạt sản phẩm. Kế hoạch của phản diện đổ vỡ. "Khoan đã, ứng dụng quản lý thời gian X à? Chế độ khóa app đang cắt đứt sóng não của tao! Nó tự động chia nhỏ công việc kìa!"
        4. Bay màu (20-30s): Phản diện bị đẩy lùi một cách quyết liệt, tan biến trong sự phẫn nộ và hứa hẹn sẽ quay lại báo thù. "Tao không thao túng được mày nữa rồi... Nhưng tao sẽ quay lại báo thù, tao sẽ chờ lúc mày yếu lòng nhất để giật dây mày lần nữa!"
      `;
    case 'energy_vampire':
      return `
        CÔNG THỨC: "Kẻ Hút Cạn Năng Lượng" (The Energy Vampire)
        - Phù hợp: Thực phẩm bổ sung (Vitamin, Hồng sâm), Đồ uống tăng lực, Nệm ngủ, hoặc Ứng dụng tăng hiệu suất làm việc.
        - Đại diện Phản diện: Một bóng đen uể oải, nặng trịch đu bám trên vai hoặc mí mắt người dùng.
        Bố cục 4 giai đoạn:
        1. Hút máu (0-5s): Phản diện hả hê vì làm nạn nhân kiệt sức. "Ngáp đi! Cứ uống ly cà phê thứ 3 đi, tao vẫn sẽ kéo sụp mí mắt mày xuống thôi."
        2. Khẳng định sức mạnh (5-10s): Chê bai các giải pháp tạm thời. "Ngủ 8 tiếng à? Vô dụng! Vì tao là sự thiếu hụt vi chất từ sâu bên trong."
        3. Sốc năng lượng (10-20s): Nạn nhân dùng sản phẩm. Phản diện bị đánh bật ra bởi ánh sáng rực rỡ từ nhân sâm/vitamin. "Cái dòng chảy gì rực rỡ thế này? Phức hợp Vitamin B đang sạc lại từng tế bào sao? Mắt chói quá!"
        4. Tan biến (20-30s): Phản diện bốc hơi hoàn toàn trong đau đớn và đe dọa sẽ quay lại báo thù. "Tao không bám nổi nữa! Năng lượng này quá mạnh! Nhưng tao sẽ quay lại báo thù, tao sẽ hút cạn mày ngay khi mày bỏ bê bản thân!"
      `;
    case 'blocking_barrier':
      return `
        CÔNG THỨC: "Bức Tường Ngăn Cách" (The Blocking Barrier)
        - Phù hợp: Tẩy tế bào chết, Nước tẩy trang, Máy lọc nước, hoặc Dịch vụ thông tắc cống.
        - Đại diện Phản diện: Lớp sừng già cỗi trên da, hoặc lớp cặn bẩn dày đặc chặn đứng mọi dòng chảy.
        Bố cục 4 giai đoạn:
        1. Thách thức (0-5s): Phản diện cười cợt khi thấy người dùng đang cố gắng vô ích. "Cứ bôi cái lọ serum tiền triệu đó lên đi! Tao ở đây để cản lại hết."
        2. Khoe khoang (5-10s): Tự hào về độ dày và lì lợm. "Tao là lớp da chết tích tụ 3 tháng trời, nước thường không rửa trôi được tao đâu."
        3. Bị phá vỡ (10-20s): Sản phẩm được thoa lên, phản diện tan chảy. "Á! Hạt scrub siêu mịn kết hợp AHA sao? Các liên kết của tao đang bị bẻ gãy! Nó đang len lỏi vào lỗ chân lông!"
        4. Sụp đổ (20-30s): Lớp sừng bị bóc tách cực đoan, để lộ làn da mới rạng rỡ. Phản diện hậm hực hứa sẽ quay lại báo thù. "Da mày nay sáng mịn quá tao không ở được. Nhưng tao sẽ quay lại báo thù, tao sẽ bao phủ mày trong bóng tối dày đặc hơn nữa!"
      `;
    case 'social_saboteur':
      return `
        CÔNG THỨC: "Kẻ Phá Bĩnh Đám Đông" (The Social Saboteur)
        - Phù hợp: Lăn khử mùi, Xịt thơm miệng, Kem đánh răng trắng sáng, Dầu gội trị gàu.
        - Đại diện Phản diện: Một đám mây màu xanh lục bốc mùi, hoặc đám vi khuẩn hôi miệng đang mở tiệc trong khoang miệng.
        Bố cục 4 giai đoạn:
        1. Cô lập nạn nhân (0-5s): Phản diện tự hào vì đuổi được mọi người xung quanh đi. "Thấy Crush của mày nhăn mặt bỏ đi chưa? Là do mùi hương tao tỏa ra đấy."
        2. Chê cười (5-10s): "Xịt nước hoa đè lên à? Chỉ làm mùi tao nồng nặc và tởm hơn thôi."
        3. Ngạt thở vì Khắc tinh (10-20s): Xịt khử mùi/Xịt thơm miệng tấn công. "Cái hạt nano bạc gì thế này? Nó đang vô hiệu hóa tuyến mồ hôi! Mùi bạc hà the mát quá tao không thở được!"
        4. Thanh tẩy (20-30s): Khu vực trở nên sạch sẽ đến mức phản diện không thể tồn tại. Nó gào thét sẽ quay lại báo thù. "Được rồi tao thua, mày thơm tho rồi đi hẹn hò đi! Nhưng tao sẽ quay lại báo thù, tao sẽ khiến mày bốc mùi thảm hại hơn bao giờ hết!"
      `;
    case 'cravings_monster':
      return `
        CÔNG THỨC: "Bậc Thầy Ảo Giác" (The Cravings Monster)
        - Phù hợp: Thực phẩm ăn kiêng, Bánh hạt dinh dưỡng (Biscotti, Granola), Trà giảm cân.
        - Đại diện Phản diện: Con quái vật "Thèm Ăn" ngồi chễm chệ trong não hoặc dạ dày, liên tục gõ thìa nĩa đòi ăn.
        Bố cục 4 giai đoạn:
        1. Thao túng (0-5s): Xúi giục nạn nhân ăn khuya. "11 giờ đêm rồi, ăn một miếng gà rán thì có sao đâu? Bụng mày đang réo đây này!"
        2. Phá hoại (5-10s): "Cái lịch trình ăn kiêng của mày rác rưởi quá, tao chỉ cần tiết ra một chút hormone thèm ngọt là mày gục ngay."
        3. Trúng kế (10-20s): Nạn nhân ăn sản phẩm (thay vì đồ ăn vặt). Phản diện nghẹn họng. "Cái gì đây? Granola không đường á? Lượng chất xơ này đang phình to ra lấp đầy dạ dày rồi! Không có một giọt đường nào cho tao hấp thụ sao?"
        4. No nê trong uất ức (20-30s): Quái vật lăn ra ngủ trong sự bất lực hoàn toàn, lầm bầm sẽ quay lại báo thù. "Tao no quá... tao đầu hàng. Nhưng tao sẽ quay lại báo thù, tao sẽ khiến mày thèm ăn điên cuồng khi mày mệt mỏi!"
      `;
    case 'silent_destroyer':
      return `
        CÔNG THỨC: "Kẻ Ăn Mòn Thầm Lặng" (The Silent Destroyer)
        - Phù hợp: Bình xịt chống rỉ sét, Sơn chống thấm, Kem chống lão hóa, Xịt chống nắng.
        - Đại diện Phản diện: Bọn vi khuẩn rỉ sét màu cam, hoặc bọn tia UV tàng hình đang âm thầm phá hoại cấu trúc.
        Bố cục 4 giai đoạn:
        1. Hoạt động ngầm (0-5s): "Mày tưởng cái xe/làn da này vẫn ổn à? Mày không thấy tao đang ăn mòn lớp sắt/collagen bên trong sao?"
        2. Đắc ý (5-10s): "Chỉ cần một cơn mưa/một tia nắng gắt nữa thôi, mọi thứ sẽ sụp đổ, nứt nẻ."
        3. Tấm khiên bảo vệ (10-20s): Lớp xịt/kem phủ lên. "Khoan! Lớp màng Nano chống thấm này ở đâu ra? Nó đang lấp đầy các vết nứt! Tia UV của tao bị dội ngược lại rồi!"
        4. Hóa đá (20-30s): Phản diện bị đóng băng hoặc văng ra ngoài một cách thô bạo, thề sẽ quay lại báo thù. "Cái màng bảo vệ này vững quá... Nhưng tao sẽ quay lại báo thù, tao sẽ ăn mòn mày từ bên trong ngay khi lớp bảo vệ này biến mất!"
      `;
    case 'internal_chaos':
      return `
        CÔNG THỨC: "Kẻ Nổi Loạn Bên Trong" (The Internal Chaos)
        - Phù hợp: Men tiêu hóa, Thuốc dạ dày, Trà detox, Băng vệ sinh (đánh vào cơn đau bụng kinh).
        - Đại diện Phản diện: Binh đoàn vi khuẩn xấu đang biểu tình, đập phá gây đầy hơi trong dạ dày, hoặc những chiếc kìm đang siết chặt tử cung.
        Bố cục 4 giai đoạn:
        1. Gây lộn xộn (0-5s): "Đau bụng hả? Đầy hơi đúng không? Bọn tao đang mở tiệc với mớ hải sản sống mày vừa ăn đấy!"
        2. Thách thức (5-10s): "Xoa bụng đi, uống nước ấm đi, chả xi nhê gì với đội quân vi khuẩn xấu của tao đâu."
        3. Binh đoàn tiếp viện (10-20s): Uống men tiêu hóa/thuốc vào. "Trời ơi! Hàng tỉ bào tử lợi khuẩn đang đổ bộ! Chúng nó có màng bọc sống sót qua axit dạ dày! Đội hình của tao vỡ rồi!"
        4. Bị quét sạch (20-30s): Sự bình yên trở lại sau một cuộc thanh trừng vi khuẩn cực đoan. Phản diện gào thét sẽ quay lại báo thù. "Tao rút quân đây! Bụng êm rồi đấy, nhưng tao sẽ quay lại báo thù, tao sẽ nổi loạn dữ dội hơn khi mày chủ quan!"
      `;
    case 'unwanted_returner':
      return `
        CÔNG THỨC: "Kẻ Phục Sinh Dai Dẳng" (The Unwanted Returner)
        - Phù hợp: Máy triệt lông tại nhà, Thuốc diệt cỏ, Kem trị nám/thâm chân sâu.
        - Đại diện Phản diện: Gốc nang lông cứng như rễ cây, hoặc hắc sắc tố Melanin dưới đáy da luôn chực chờ ngoi lên.
        Bố cục 4 giai đoạn:
        1. Cười nhạo (0-5s): Phản diện cười ha hả khi bị cắt ngang. "Cứ cạo đi! Nhổ đi! Mày chỉ cắt được phần ngọn thôi, cái rễ tao vẫn cắm chặt dưới da này."
        2. Khoe tốc độ mọc (5-10s): "Chỉ 3 ngày nữa thôi tao sẽ mọc lại, đen hơn, cứng hơn và ngứa hơn cho mày xem."
        3. Tia sáng tử thần (10-20s): Bắn tia laser/IPL. "Ánh sáng gì chớp nháy thế này? Xung ánh sáng IPL đang xuyên thẳng xuống tận nang lông! Gốc rễ của tao đang bị đốt cháy, nó teo lại rồi!"
        4. Chết rụi (20-30s): Gốc nang lông bị tiêu diệt tận gốc, chết rụi hoàn toàn. Phản diện rủa sả sẽ quay lại báo thù. "Tao không mọc lại được nữa rồi... Nhưng tao sẽ quay lại báo thù, tao sẽ phục sinh mạnh mẽ hơn để xâm chiếm làn da mày!"
      `;
    default:
      return `
        CÔNG THỨC: "Kẻ Xâm Nhập Ngạo Mạn" (The Arrogant Invader)
        - Phù hợp: Sản phẩm trị liệu, làm đẹp, diệt côn trùng, diệt khuẩn.
        - Đại diện Phản diện: Một sinh vật gớm ghiếc tàn phá cơ thể/tài sản (Ví dụ: Cục mỡ thừa, Cục mụn viêm, Mảng bám răng, Rệp giường).
        Bố cục 4 giai đoạn:
        1. Khiêu khích (0-5s): Phản diện cười cợt, khoe khoang về sự tàn phá nó đang gây ra. (Ví dụ mụn viêm: "Định nặn tao á? Cứ nặn đi, tao sẽ để lại cái sẹo rỗ chà bá cho mày xem!")
        2. Vô vọng (5-10s): Nhấn mạnh các cách thông thường không có tác dụng. "Mấy cái kem bôi rẻ tiền kia chỉ làm tao béo thêm thôi."
        3. Hoảng loạn vì Khắc tinh (10-20s): Sản phẩm xuất hiện (thường đi kèm hiệu ứng ánh sáng/vũ khí). Phản diện hoảng sợ và tự khai ra USP của sản phẩm. "Khoan! Axit Salicylic 2% công nghệ nano à? Nó đang xuyên qua lớp bã nhờn của tao!"
        4. Bị tiêu diệt & Lời nguyền (20-30s): Phản diện bị tiêu diệt một cách cực đoan (tan chảy, nổ tung, hoặc bị quét sạch không dấu vết). Trước khi biến mất hoàn toàn, nó để lại lời nguyền/lời dặn hậm hực về việc sẽ quay lại báo thù. "Á á! Mày thắng... nhưng tao sẽ quay lại báo thù, tao sẽ tàn phá mày gấp đôi khi mày sơ hở!"
      `;
  }
};

/**
 * Phân tích chi tiết bối cảnh để đồng nhất 100% qua các cảnh.
 */
export const analyzeDetailedBackground = async (backgroundNote: string, backgroundPart: any | null): Promise<string> => {
  const prompt = `
    Nhiệm vụ: Phân tích và mở rộng mô tả bối cảnh (background) dưới đây thành một mô tả CỰC KỲ CHI TIẾT và CHUYÊN NGHIỆP để đảm bảo tính đồng nhất 100% khi tạo ảnh/video AI.
    
    Mô tả gốc: "${backgroundNote}"
    
    YÊU CẦU PHÂN TÍCH:
    1. TÍNH THỰC TẾ & CẤU TRÚC LOGIC (QUAN TRỌNG): Nếu bối cảnh là sinh học (trong miệng, trong cơ thể), bối cảnh PHẢI tuân thủ đúng cấu trúc giải phẫu thực tế. TUYỆT ĐỐI KHÔNG tạo ra các cấu trúc kỳ dị như nhiều hàm răng chồng chéo, răng mọc ở vị trí không tưởng. Mọi thứ phải trông tự nhiên và hợp lý.
    2. CHI TIẾT KHÔNG GIAN: Mô tả loại phòng hoặc môi trường, kích thước ước lượng, phong cách thiết kế.
    3. CHI TIẾT VẬT LIỆU: Mô tả chất liệu bề mặt (men răng, mô nướu, gỗ, gạch, kim loại...).
    4. CHI TIẾT NỘI THẤT/VẬT THỂ XUNG QUANH: Liệt kê các vật dụng hoặc bộ phận xung quanh kèm theo màu sắc và vị trí logic của chúng.
    5. ÁNH SÁNG & KHÔNG KHÍ: Mô tả nguồn sáng, cường độ, nhiệt độ màu và cảm giác chung.
    6. CHI TIẾT NHỎ (MICRO-DETAILS): Các chi tiết tăng độ chân thực như độ bóng, vân bề mặt, phản chiếu...
    
    YÊU CẦU ĐẦU RA:
    - Trả về một đoạn văn bản Tiếng Việt súc tích nhưng đầy đủ các yếu tố trên.
    - Tập trung vào các từ khóa thị giác mạnh mẽ.
    - Mục tiêu là để AI có thể tái tạo lại CHÍNH XÁC bối cảnh này trong mọi lần tạo ảnh.
  `;

  const contents: any[] = [{ text: prompt }];
  if (backgroundPart) {
    contents.push({ text: "ẢNH THAM CHIẾU BỐI CẢNH:" });
    contents.push({ inlineData: backgroundPart });
  }

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim() || backgroundNote;
  }).catch((error) => {
    console.error("Lỗi phân tích bối cảnh:", error);
    return backgroundNote;
  });
};

/**
 * Tạo kịch bản nhân hóa dựa trên các tham số đầu vào.
 */
export const generatePersonificationScript = async (
  healthKeyword: string,
  ctaProduct: string,
  frameCount: number,
  gender: string,
  voice: string,
  addressing: string,
  style: string,
  characterInfo: string,
  backgroundDescription: string,
  language: string = 'vi'
): Promise<string[]> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const styleDetail = getStyleDetailedInstruction(style);
  const targetLang = getLanguageLabel(language);
  const { persona, context } = getPersonaContext(language);
  const lengthInstruction = getScriptLengthInstruction(language);

  const prompt = `
    Nhiệm vụ: Tạo kịch bản TikTok nhân hóa bộ phận cơ thể hoặc vật thể dựa trên USP SẢN PHẨM.
    USP SẢN PHẨM: "${healthKeyword}"
    SẢN PHẨM CTA: "${ctaProduct}"
    SỐ KHUNG HÌNH: ${frameCount}
    NGÔN NGỮ ĐẦU RA: ${targetLang} (Hãy viết toàn bộ kịch bản bằng ngôn ngữ này)
    PERSONA: ${persona}
    BỐI CẢNH VĂN HÓA: ${context}
    
    NHÂN VẬT: Giới tính ${gender}, Đặc điểm giọng nói & Văn phong: ${voiceDetail}.
    MÔ TẢ NHÂN VẬT & VỊ TRÍ: "${characterInfo}" (Bao gồm ngoại hình và nơi nhân vật đang ở, ví dụ: mụn cóc trên ngón tay, răng sâu trong hàm răng).
    MÔ TẢ BỐI CẢNH CHUNG: "${backgroundDescription}"
    PHONG CÁCH KỊCH BẢN: "${styleDetail}".
    
    HƯỚNG DẪN XỬ LÝ:
    1. Phân tích USP sản phẩm để tìm ra nhân vật nhân hóa liên quan nhất (thường là kẻ phản diện gây ra vấn đề mà sản phẩm giải quyết). 
    2. Tạo kịch bản từ góc nhìn nhân vật đó. Nhân vật này PHẢI nằm ở vị trí được mô tả trong: "${characterInfo}".
    3. XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe) cho các cảnh của Phản diện. Riêng CẢNH CUỐI (CTA) của Sản phẩm phải đổi sang "Tôi - Bạn". (Nếu ngôn ngữ không phải Tiếng Việt, hãy sử dụng đại từ tương đương phù hợp nhất).
    4. TUÂN THỦ NGHIÊM NGẶT CẤU TRÚC VÀ DIỄN BIẾN CỦA PHONG CÁCH KỊCH BẢN: "${styleDetail}".
    5. CẢNH CUỐI CÙNG (CTA & USP): 
    - Nhân vật nói lúc này PHẢI chính là SẢN PHẨM: "${ctaProduct}".
    - XƯNG HÔ TRONG CẢNH NÀY: BẮT BUỘC sử dụng cặp xưng hô "Tôi - Bạn" (Sản phẩm xưng Tôi, người nghe là Bạn). (Nếu ngôn ngữ không phải Tiếng Việt, hãy sử dụng đại từ tương đương phù hợp nhất).
    - Lời thoại PHẢI tuân thủ cấu trúc: "[Tên sản phẩm] + [Công dụng/USP: ${healthKeyword}] + Muốn [Lợi ích] thì mua ngay ở GÓC TRÁI".
    - Phản diện (đang ở vị trí mô tả trong "${characterInfo}") phải bị tiêu diệt hoặc khuất phục hoàn toàn bởi sức mạnh của sản phẩm.
    - Lời thoại cuối cùng PHẢI hướng người dùng mua hàng bằng cách nhấn vào giỏ hàng hoặc link ở GÓC TRÁI màn hình.
    6. BỐI CẢNH: Kịch bản phải diễn ra trong bối cảnh được mô tả tại phần "MÔ TẢ BỐI CẢNH CHUNG". Nếu có mô tả về ngoại hình nhân vật và vị trí nhân vật, hãy lồng ghép các chi tiết đó vào lời thoại hoặc hành động một cách tự nhiên.
    7. QUY TẮC KHỞI ĐẦU & NỘI DUNG (BẮT BUỘC):
    - Cảnh 1 PHẢI bắt đầu bằng câu giới thiệu: "Tao là [Tên nhân vật phản diện] đang ở [Vị trí nhân vật]..." (Sử dụng đại từ xưng hô phù hợp với "${addressing}" nhưng phải giữ cấu trúc "Tôi/Tao là..."). (Nếu ngôn ngữ không phải Tiếng Việt, hãy sử dụng đại từ tương đương phù hợp nhất).
    - Các cảnh đầu tiên PHẢI tập trung xoáy sâu vào NỖI ĐAU, sự khó chịu, tự ti hoặc hậu quả tồi tệ mà người dùng đang gặp phải do nhân vật phản diện này gây ra tại vị trí được mô tả trong "${characterInfo}".
    
    !!! QUY TẮC ĐỘ DÀI NGHIÊM NGẶT !!!:
    ${lengthInstruction}
    
    YÊU CẦU NGÔN NGỮ: Viết bằng ${targetLang}. Tuân thủ quy tắc văn phong vùng miền (nếu là Tiếng Việt): ${voiceDetail}.
    Trả về mảng JSON các chuỗi ký tự.
    TUYỆT ĐỐI KHÔNG DÙNG TỪ CẤM: ${FORBIDDEN_TERMS}
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: { 
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return JSON.parse(cleanJsonResponse(response.text || '[]'));
  }).catch((e) => {
    console.error("Lỗi tạo kịch bản nhân hóa:", e);
    return [];
  });
};

/**
 * Tạo hình ảnh nhân hóa dựa trên kịch bản và các tham số hình ảnh.
 */
export const generatePersonificationImage = async (
  script: string,
  healthKeyword: string,
  ctaProduct: string,
  gender: string,
  characterInfo: string,
  backgroundDescription: string,
  sceneIdea: string,
  stageIndex: number = 1,
  totalStages: number = 4,
  regenNote: string = "",
  showProduct: boolean = true,
  visualStyle: string = "3D",
  characterPart?: { data: string; mimeType: string },
  productImages: { data: string; mimeType: string }[] = [],
  language: string = 'vi'
): Promise<string> => {
  const ai = getAiClient('image');
  const { persona, context } = getPersonaContext(language);
  
  const noProductKeywords = ["không có sản phẩm", "xóa sản phẩm", "no product", "remove product", "without product"];
  const isNoProductRequested = !showProduct || (regenNote + sceneIdea).toLowerCase().split(' ').some(word => noProductKeywords.includes(word));

  const stylePrompt = visualStyle === 'Realistic' 
    ? "Nhiếp ảnh điện ảnh thực tế, siêu thực, 8k, chi tiết cao, ánh sáng tự nhiên, ảnh chuyên nghiệp."
    : "Phong cách hoạt hình 3D Pixar, màu sắc rực rỡ, CGI bóng bẩy, kiệt tác.";

  // Logic cho các trạng thái hình ảnh lũy tiến
  let stageVisualInstruction = "";
  const progress = stageIndex / totalStages;
  const isLastStage = stageIndex === totalStages;

  if (progress <= 0.4) {
    stageVisualInstruction = `
      GIAI ĐOẠN HÌNH ẢNH: TRẠNG THÁI VẤN ĐỀ (PROBLEM STATE).
      - Đối tượng (ví dụ: răng, da, nhà bếp, đường ống) PHẢI trông BẨN, HƯ HỎNG, Ố VÀNG hoặc BỊ SÂU/HỎNG.
      - Bầu không khí nên hơi u ám hoặc căng thẳng.
      - Nhân vật phản diện đang chiếm ưu thế tại vị trí được mô tả trong: "${characterInfo}".
    `;
  } else if (progress <= 0.7) {
    stageVisualInstruction = `
      GIAI ĐOẠN HÌNH ẢNH: TRẠNG THÁI CHUYỂN GIAO (TRANSITION STATE).
      - Sản phẩm "${ctaProduct}" bắt đầu tác động.
      - Cho thấy bụi bẩn/hư hại đang được RỬA TRÔI, HÒA TAN hoặc SỬA CHỮA.
      - Nhân vật phản diện bắt đầu hoảng sợ hoặc bị đẩy lùi tại vị trí được mô tả trong: "${characterInfo}".
    `;
  } else if (!isLastStage) {
    stageVisualInstruction = `
      GIAI ĐOẠN HÌNH ẢNH: TRẠNG THÁI KẾT QUẢ SƠ BỘ (PRE-SOLUTION STATE).
      - Đối tượng tại vị trí mô tả trong "${characterInfo}" đã sạch sẽ, sáng sủa và khỏe mạnh.
      - Nhân vật phản diện đã bị đánh bại hoàn toàn, tan chảy hoặc biến mất trong sự hậm hực.
      - Sản phẩm "${ctaProduct}" xuất hiện như người chiến thắng.
    `;
  } else {
    stageVisualInstruction = `
      GIAI ĐOẠN HÌNH ẢNH: TRẠNG THÁI CTA CUỐI CÙNG (FINAL CTA STATE).
      - Sản phẩm "${ctaProduct}" PHẢI xuất hiện nổi bật như một "anh hùng" hoặc nhân vật chính to lớn nổi bật đang nói trực tiếp với khán giả.
      - Đối tượng tại vị trí mô tả trong "${characterInfo}" HOÀN HẢO, SẠCH SẼ, SÁNG SỦA.
      - Bầu không khí tươi sáng, hạnh phúc và thành công.
    `;
  }

  const visualRules = `
    CÁC QUY TẮC HÌNH ẢNH QUAN TRỌNG (CHÍNH SÁCH NGHIÊM NGẶT KHÔNG CÓ CHỮ):
    1. TUYỆT ĐỐI KHÔNG CÓ CHỮ, KHÔNG CÓ CHỮ CÁI, KHÔNG CÓ SỐ, KHÔNG CÓ KÝ TỰ.
    2. KHÔNG CÓ CHÚ THÍCH, KHÔNG CÓ PHỤ ĐỀ, KHÔNG CÓ HỘP THOẠI, KHÔNG CÓ BONG BÓNG LỜI THOẠI.
    3. Nền phải SẠCH và KHÔNG có biển báo, áp phích, nhãn mác hoặc từ ngữ viết tay.
    4. Nếu bối cảnh ngụ ý một màn hình hoặc biển báo, hãy để TRỐNG hoặc Trừu tượng.
    5. KHÔNG có các yếu tố giao diện người dùng (UI), KHÔNG có hình mờ (watermark), KHÔNG có lớp phủ (overlay).
    6. Hình ảnh phải hoàn toàn là kể chuyện bằng hình ảnh.
    7. TUYỆT ĐỐI KHÔNG CÓ BIỂU TƯỢNG (ICON), KHÔNG CÓ ĐỒ HỌA, KHÔNG CÓ EMOJI, KHÔNG CÓ HIỆU ẢNH.
    8. KHÔNG mô phỏng giao diện TikTok hoặc hiệu ứng chỉnh sửa video. Nó phải trông giống như một bản RENDER 3D THÔ.
    
    CÁC HẠN CHẾ & QUY TẮC QUAN TRỌNG: 
    1. KHÔNG CÓ TRẺ EM, KHÔNG CÓ TRẺ NHỎ, KHÔNG CÓ EM BÉ. 
    2. Phải trông giống như ${stylePrompt}
    
    ${isNoProductRequested ? '3. TUYỆT ĐỐI KHÔNG CÓ SẢN PHẨM/THIẾT BỊ TRONG HÌNH ẢNH NÀY.' : `
    3. ĐỘ TRUNG THỰC CỦA SẢN PHẨM NGHIÊM NGẶT (BẮT BUỘC - TUYỆT ĐỐI):
       - Sản phẩm "${ctaProduct}" PHẢI KHỚP với các hình ảnh tham chiếu đầu vào được cung cấp.
       - GIỮ NGUYÊN HOA VĂN & KẾT CẤU: Bất kỳ hoa văn, logo hoặc thiết kế nào trên bề mặt sản phẩm đều phải được giữ nguyên.
       - GIỮ NGUYÊN KÍCH THƯỚC: Không thay đổi kích thước hoặc làm biến dạng logic sản phẩm.
       - TỶ LỆ ĐỒNG NHẤT: Đảm thước và tỷ lệ của sản phẩm phải đồng nhất.
       - KHÓA ngoại hình sản phẩm chính xác theo các ảnh gốc được cung cấp tỷ lệ 1:1.`}
  `;

  const isFinalStage = isLastStage;

  const characterFidelity = (characterPart && !isFinalStage) 
    ? `THAM CHIẾU NHÂN VẬT: Bạn PHẢI sử dụng CHÍNH XÁC thiết kế nhân vật từ hình ảnh CHARACTER_REFERENCE. Duy trì sự nhất quán về danh tính 1:1 tại vị trí được mô tả trong: "${characterInfo}". Đây là CÙNG MỘT nhân vật như trong các khung hình trước.`
    : isFinalStage
      ? `DANH TÍNH NHÂN VẬT: Nhân vật nhân hóa lúc này PHẢI là SẢN PHẨM "${ctaProduct}". Sản phẩm có khuôn mặt, mắt, miệng và đang nói chuyện như một nhân vật "Anh hùng".`
      : `DANH TÍNH NHÂN VẬT: Một nhân vật được nhân hóa dựa trên: "${healthKeyword.substring(0, 100)}". 
         - Nếu bối cảnh ngụ ý lạm dụng sức khỏe hoặc hậu quả tiêu cực, nhân vật PHẢI trông giống như một biểu hiện nhân hóa của hậu quả đó (ví dụ: một lá gan kiệt quệ, một đôi mắt mệt mỏi, một tế bào mỡ tham lam). 
         - Nhân vật nên trông giống như một nạn nhân hoặc một kẻ phản diện do thói quen xấu của người dùng gây ra.
         - Nhân vật PHẢI nằm ở vị trí được mô tả trong: "${characterInfo}".
         - Đặc điểm giới tính: ${gender}.
         - BẮT BUỘC: Duy trì sự nhất quán về danh tính nhân vật 1:1 trên tất cả các khung hình. Các đặc điểm, màu sắc và trang phục của nhân vật phải giống hệt với các cảnh trước đó.`;

  const characterBehavior = isFinalStage 
    ? "The character (Product) must have a CONFIDENT, FRIENDLY, VICTORIOUS expression."
    : `The character (Villain) at the location described in "${characterInfo}" must always have a GRUMPY, ANGRY, IRRITATED, SCARY expression, with moving eyes, nose, and mouth. ABSOLUTELY NO ARMS, NO LEGS.`;

  const prompt = `
    Style: ${stylePrompt}
    Orientation: VERTICAL 9:16 FULL SCREEN.
    IMPORTANT: NO BLACK BARS, NO LETTERBOXING EFFECTS. Image MUST fill the entire 9:16 frame.
    STRICT NO-TEXT POLICY: ABSOLUTELY NO LETTERS, WORDS, NUMBERS, OR CHARACTERS IN THE IMAGE. 
    !!! DO NOT ADD ANY CAPTIONS, SUBTITLES, OR DIALOGUE BOXES !!!
    
    CHARACTER DESCRIPTION & POSITION: "${isFinalStage ? 'Product ' + ctaProduct : characterInfo}"
    GENERAL BACKGROUND DESCRIPTION: "${backgroundDescription}"
    PERSONA: ${persona}
    CULTURAL CONTEXT: ${context}
    ${characterFidelity}
    ${stageVisualInstruction}
    
    !!! SPECIFIC SCENE IDEA: "${sceneIdea}" !!!
    Action description: "${script}".
    
    ${characterBehavior}
    ANATOMICAL LOGIC & REALISM: The background MUST adhere to correct realistic anatomical structures. If inside a mouth, only 2 rows of teeth (upper and lower) symmetrical, NO messy teeth, NO multiple overlapping rows of teeth. Body parts must have logical shapes and positions.
    ENVIRONMENTAL INTEGRATION: The character MUST be naturally and logically integrated into the background at the position described in: "${characterInfo}". If the character is a body part (like a tooth, liver, lung), it MUST appear in the correct anatomical position next to other parts of the same type or in its natural environment (e.g., the personified tooth must stand in the jaw with other normal teeth, the liver must be in the body cavity). ABSOLUTELY DO NOT leave the character isolated, floating, or separated from its surroundings.
    PROPORTIONAL SCALING: The character's size should be compact and fit the realistic proportions of the surrounding context, creating a sense that it is part of that world.
    
    Background: The environment MUST strictly adhere to the GENERAL BACKGROUND: "${backgroundDescription}". Specific scene details: "${sceneIdea}". You must integrate the character's appearance and background exactly as described in the GENERAL BACKGROUND.
    
    ${visualRules}
    ${regenNote ? `Additional feedback: ${regenNote}` : ""}
  `;

  const contents: any[] = [{ text: prompt }];
  if (characterPart && !isFinalStage) contents.push({ inlineData: characterPart });
  if (!isNoProductRequested) productImages.forEach(img => contents.push({ inlineData: img }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (e) {
    console.error("Lỗi tạo hình ảnh", e);
    throw e;
  }
};

/**
 * Tạo ảnh nhân vật nhân hóa mẫu để đồng bộ.
 */
export const generateCharacterRef = async (
  healthKeyword: string,
  ctaProduct: string,
  characterInfo: string,
  visualStyle: string = "3D",
  gender: string = "Nữ"
): Promise<string> => {
  const ai = getAiClient('image');
  
  const stylePrompt = visualStyle === 'Realistic' 
    ? "Nhiếp ảnh điện ảnh thực tế, siêu thực, 8k, chi tiết cao, ánh sáng tự nhiên, ảnh chuyên nghiệp."
    : "Phong cách hoạt hình 3D Pixar, màu sắc rực rỡ, CGI bóng bẩy, kiệt tác.";

  const prompt = `
    Nhiệm vụ: Tạo một ảnh chân dung nhân vật nhân hóa mẫu (Character Reference).
    Ý TƯỞNG NGUỒN: "${healthKeyword}"
    SẢN PHẨM: "${ctaProduct}"
    MÔ TẢ NHÂN VẬT & VỊ TRÍ: "${characterInfo}" (Bao gồm ngoại hình và nơi nhân vật đang ở, ví dụ: mụn cóc trên ngón tay, răng sâu trong hàm răng).
    Giới tính: ${gender}
    Phong cách: ${stylePrompt}
    Hướng: VUÔNG 1:1.
    
    QUY TẮC NHÂN HÓA QUAN TRỌNG:
    1. Nhân vật PHẢI là một bộ phận cơ thể (ví dụ: lá gan, phổi, dạ dày, trái tim), một loại virus/vi khuẩn, hoặc một tác nhân có hại (ví dụ: cục mỡ, mảng bám, tế bào ung thư) liên quan trực tiếp đến vấn đề sức khỏe hoặc sản phẩm được đề cập.
    2. Nếu sản phẩm là "Trà mát gan" -> Nhân vật là một Lá gan. Nếu là "Cai thuốc lá" -> Nhân vật là Phổi. Nếu là "Giảm cân" -> Nhân vật là Cục mỡ.
    3. Nhân vật phải có đặc điểm của một con virus (có mắt, mũi, miệng) and biểu cảm CỤC CẰN, GIẬN DỮ, CÁU GẮT, KHÓ CHỊU, và GHÊ RỢN. TUYỆT ĐỐI KHÔNG CÓ TAY, KHÔNG CÓ CHÂN.
    4. Nhân vật PHẢI nằm ở vị trí được mô tả trong: "${characterInfo}".
    5. Nhân vật phải trông như đang chịu đựng hậu quả của thói quen xấu (ví dụ: lá gan bị xơ xác, phổi bị đen, cục mỡ tham lam).
    
    YÊU CẦU HÌNH ẢNH:
    - Nhân vật PHẢI NHỎ, nằm chính giữa khung hình, chiếm khoảng 1/3 diện tích khung hình. Xung quanh là không gian trắng rộng rãi.
    - PHÔNG NỀN: TUYỆT ĐỐI LÀ NỀN TRẮNG TINH KHIẾT (PLAIN WHITE BACKGROUND), KHÔNG CÓ CHI TIẾT PHỤ, KHÔNG CÓ ĐỒ VẬT KHÁC.
    - TUYỆT ĐỐI KHÔNG CÓ CHỮ, KHÔNG CÓ VĂN BẢN.
    - Hình ảnh chất lượng cao, sắc nét, tỉ lệ 1:1.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (e) {
    console.error("Lỗi tạo ảnh nhân vật mẫu", e);
    throw e;
  }
};

/**
 * Tạo prompt cho AI Video (VEO) dựa trên kịch bản và các tham số.
 */
export const generatePersonificationVeoPrompt = async (
  script: string,
  healthKeyword: string,
  ctaProduct: string,
  gender: string,
  voice: string,
  style: string,
  characterInfo: string,
  backgroundDescription: string,
  sceneIdea: string,
  stageIndex: number = 1,
  totalStages: number = 4,
  visualStyle: string = "3D",
  language: string = 'vi'
): Promise<string> => {
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  const { persona, context } = getPersonaContext(language);

  const stylePrompt = visualStyle === 'Realistic' 
    ? "Nhiếp ảnh điện ảnh thực tế, siêu thực, 8k, chi tiết cao, ánh sáng tự nhiên, ảnh chuyên nghiệp."
    : "Phong cách hoạt hình 3D Pixar, màu sắc rực rỡ, CGI bóng bẩy, kiệt tác.";

  // Logic cho các trạng thái hình ảnh lũy tiến (giống như tạo hình ảnh)
  let stageVisualInstruction = "";
  const progress = stageIndex / totalStages;
  const isLastStage = stageIndex === totalStages;

  if (progress <= 0.4) {
    stageVisualInstruction = `GIAI ĐOẠN HÌNH ẢNH: TRẠNG THÁI VẤN ĐỀ. Đối tượng (răng, da, v.v.) phải trông BẨN, HƯ HỎNG, Ố VÀNG hoặc BỊ SÂU/HỎNG. Nhân vật phản diện đang chiếm ưu thế tại vị trí mô tả trong: "${characterInfo}".`;
  } else if (progress <= 0.7) {
    stageVisualInstruction = `GIAI ĐOẠN HÌNH ẢNH: TRẠNG THÁI CHUYỂN GIAO. Sản phẩm đang hoạt động tích cực. Cho thấy bụi bẩn/hư hại đang được RỬA TRÔI hoặc SỬA CHỮA. Nhân vật phản diện bắt đầu hoảng sợ tại vị trí mô tả trong: "${characterInfo}".`;
  } else if (!isLastStage) {
    stageVisualInstruction = `GIAI ĐOẠN HÌNH ẢNH: TRẠNG THÁI KẾT QUẢ SƠ BỘ. Đối tượng tại vị trí mô tả trong "${characterInfo}" đã sạch sẽ, sáng sủa. Nhân vật phản diện đã bị đánh bại hoàn toàn hoặc biến mất.`;
  } else {
    stageVisualInstruction = `GIAI ĐOẠN HÌNH ẢNH: TRẠNG THÁI CTA CUỐI CÙNG. Sản phẩm xuất hiện nổi bật như nhân vật chính đang nói. Đối tượng tại vị trí mô tả trong "${characterInfo}" HOÀN HẢO, SẠCH SẼ, SÁNG SỦA.`;
  }

  const isFinalStage = isLastStage;
  const characterBehavior = isFinalStage 
    ? "Nhân vật (Sản phẩm) phải có biểu cảm TỰ TIN, THÂN THIỆN, CHIẾN THẮNG."
    : `Nhân vật (Phản diện) tại vị trí mô tả trong "${characterInfo}" phải luôn có biểu cảm CỤC CẰN, GIẬN DỮ, CÁU GẮT, KHÓ CHỊU, GHÊ RỢN. TUYỆT ĐỐI KHÔNG CÓ TAY, KHÔNG CÓ CHÂN.`;

  const systemPrompt = `
    Bạn là chuyên gia viết prompt cho AI Video (VEO-3). Tạo kịch bản chi tiết dài 8 giây cho nhân vật nhân hóa.
    
    CẤU TRÚC PROMPT (VIẾT LIỀM MẠCH TRÊN 1 DÒNG):
    Đoạn 1: Nhân vật & bối cảnh. (Mô tả nhân vật & vị trí: ${isFinalStage ? 'Sản phẩm ' + ctaProduct : characterInfo}. Phong cách: ${stylePrompt}. PERSONA: ${persona}. BỐI CẢNH VĂN HÓA: ${context}. BỐI CẢNH CHUNG PHẢI TUÂN THỦ TUYỆT ĐỐI: ${backgroundDescription}. Bối cảnh cụ thể: ${sceneIdea}. ${stageVisualInstruction}. LOGIC GIẢI PHẪU: Bối cảnh tuân thủ đúng cấu trúc giải phẫu thực tế, không có cấu trúc kỳ dị, không có nhiều hàm răng chồng chéo. TÍCH HỢP MÔI TRƯỜNG: Nhân vật PHẢI được tích hợp tự nhiên và logic vào bối cảnh tại vị trí mô tả trong: ${characterInfo}. TỶ LỆ HỢP LÝ: Kích thước nhân vật nhỏ gọn, phù hợp với tỷ lệ thực tế của môi trường xung quanh).
    Đoạn 2: Hành động & tương tác. (Cử động môi khớp lời thoại, hành động theo phong cách ${style}. ${characterBehavior}).
    Đoạn 3: Góc quay & chuyển động máy. (Camera Pan/Zoom/Dolly mượt mà, tỉ lệ 9:16).
    Đoạn 4: Hậu cảnh & đạo cụ. (Môi trường sống động, ánh sáng chuyên nghiệp, bám sát mô tả bối cảnh: ${backgroundDescription}).
    Đoạn 5: Lời thoại (Lip-sync): ✨ Model speaks in ${voiceDetail} characteristics (${voiceGender}). Dialogue: "${script}"
    Đoạn 6: Thông số: 9:16, 4K, ${visualStyle === 'Realistic' ? 'Realistic Photo' : '3D Animation'}, 60fps.
    LƯU Ý QUAN TRỌNG: TUYỆT ĐỐI KHÔNG CÓ CHỮ, VĂN BẢN, PHỤ ĐỀ TRONG VIDEO (TRỪ PHẦN LIP-SYNC).
    
    YÊU CẦU: Trả về 1 dòng Tiếng Anh duy nhất (trừ phần lời thoại).
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: systemPrompt }] }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  }).catch((error) => {
    console.error("Lỗi tạo prompt video nhân hóa:", error);
    return "";
  });
};

export const generatePersonificationImagePromptAI = async (
  script: string,
  gender: string,
  voice: string,
  style: string,
  characterInfo: string,
  backgroundDescription: string,
  sceneIdea: string,
  stageIndex: number = 1,
  totalStages: number = 4,
  visualStyle: string = "3D",
  customPrompt: string = "",
  language: string = 'vi'
): Promise<string> => {
  const { persona, context } = getPersonaContext(language);
  
  const stylePrompt = visualStyle === 'Realistic' 
    ? "Cinematic photorealistic photography, hyper-realistic, 8k, highly detailed, natural lighting, professional photo, shallow depth of field."
    : "3D Pixar animation style, vibrant colors, polished CGI, masterpiece, soft global illumination.";

  let stageVisualInstruction = "";
  const progress = stageIndex / totalStages;
  const isLastStage = stageIndex === totalStages;

  if (progress <= 0.4) {
    stageVisualInstruction = `IMAGE STAGE: PROBLEM STATE. The target object (teeth, skin, etc.) must look DIRTY, DAMAGED, YELLOWED, or DECAYED. The villain character is dominating at the location: "${characterInfo}".`;
  } else if (progress <= 0.7) {
    stageVisualInstruction = `IMAGE STAGE: TRANSITION STATE. The product is actively working. Show dirt/damage being WASHED AWAY or REPAIRED. The villain character is starting to panic at the location: "${characterInfo}".`;
  } else if (!isLastStage) {
    stageVisualInstruction = `IMAGE STAGE: PRELIMINARY RESULT STATE. The target object at "${characterInfo}" is now clean and bright. The villain character is completely defeated or disappeared.`;
  } else {
    stageVisualInstruction = `IMAGE STAGE: FINAL CTA STATE. The product appears prominently as the main character. The target object at "${characterInfo}" is PERFECT, CLEAN, AND SHINY.`;
  }

  const characterBehavior = isLastStage 
    ? "The Product character has a CONFIDENT, FRIENDLY, VICTORIOUS expression."
    : `The Villain character at "${characterInfo}" must have a GRUMPY, ANGRY, IRRITATED, SCARY expression. ABSOLUTELY NO ARMS, NO LEGS.`;

  const systemPrompt = `
    You are an expert AI Image Prompt Engineer (Midjourney, DALL-E, Flux). 
    Your task is to create a highly detailed, descriptive English prompt for a single image frame of a personification video.
    
    INPUT DATA:
    - Script Content: "${script}"
    - Scene Idea: "${sceneIdea}"
    - Character Info: "${characterInfo}"
    - Background: "${backgroundDescription}"
    - Visual Style: ${visualStyle}
    - Stage: ${stageIndex}/${totalStages}
    - Custom Note: "${customPrompt}"
    - Persona: ${persona}
    - Culture Context: ${context}
    
    RULES:
    1. STYLE: ${stylePrompt}
    2. STAGE LOGIC: ${stageVisualInstruction}
    3. CHARACTER: ${characterBehavior}
    4. ANATOMY: Background must follow realistic anatomical structures. No weird structures, no multiple overlapping rows of teeth.
    5. INTEGRATION: Characters must be naturally and logically integrated into the environment at the specified location.
    6. PROPORTIONS: Character size should be compact and fit the realistic proportions of the surroundings.
    7. NO TEXT: Absolutely no text, words, subtitles, or UI elements in the image.
    8. ASPECT RATIO: 9:16 vertical.
    
    YÊU CẦU: Trả về 1 đoạn prompt Tiếng Anh duy nhất, tập trung vào mô tả thị giác chi tiết (ánh sáng, chất liệu, bố cục, biểu cảm). Không bao gồm bất kỳ lời dẫn nào.
  `;

  return callWithAiFallback(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: systemPrompt }] }
    });
    return response.text?.trim() || "";
  }).catch((e) => {
    console.error("Error generating image prompt:", e);
    return "Error generating image prompt.";
  });
};
