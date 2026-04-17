
import React from 'react';
import { theme } from '../constants/colors';

const VPCS: React.FC = () => {
  const sections = [
    {
      title: "1. CHỦ ĐỀ Y TẾ",
      items: [
        { label: "Bệnh tiêu cực", content: "Tâm thần, ung thư, kiết lị, béo phì,..." },
        { label: "Sản phẩm", content: "Thực phẩm chức năng, collagen,..." },
        { label: "Danh từ người", content: "Bệnh nhi, bệnh nhân, bác sỹ điều trị,..." },
        { label: "Động từ cấm", content: "Trị bệnh, chữa bệnh, dứt điểm, chắc chắn khỏi..." },
        { label: "Từ bạo lực", content: "Giết, đâm, đánh, chém, tử nạn, tự tử, tử vong, thương vong, chết chóc, đuối nước, triệu chứng,..." },
        { label: "Nhạy cảm", content: "Nôn mửa, kinh nguyệt, tiểu tiện, đại tiện." },
        { label: "Tình trạng", content: "Khuyết tật, khiếm khuyết, bệnh dịch, căn bệnh,..." },
        { label: "Ví dụ tránh", content: "Giảm cân cấp tốc, Giảm mỡ siêu nhanh, Bổ thận tráng dương, Tăng cường sinh lý, Trẻ hóa như 18 tuổi..." }
      ]
    },
    {
      title: "2. TÀI CHÍNH & TIỀN TỆ",
      items: [
        { label: "Vay nợ", content: "Vay vốn, vay tín chấp, vay tín dụng, nợ." },
        { label: "Tiền tệ", content: "Giá cả, đắt, rẻ, tài chính." },
        { label: "Lãi suất", content: "Lãi, lãi suất, giải ngân." },
        { label: "Thuế", content: "Trốn thuế, thu thuế, đóng thuế." },
        { label: "Giao dịch", content: "Kiếm tiền, hoàn vốn, hoàn tiền." }
      ]
    },
    {
      title: "3. ĐÀO TẠO & VIỆC LÀM",
      items: [
        { label: "Đào tạo", content: "Đào tạo, tuyển sinh, khoá học, tư vấn, đăng ký, điền form,..." },
        { label: "Việc làm", content: "Tìm việc, tuyển nhân viên, tuyển nhân sự, tuyển dụng..." }
      ]
    },
    {
      title: "4. CAMERA & GIÁM SÁT",
      items: [
        { label: "Từ khóa", content: "Camera giám sát, camera an ninh, camera theo dõi, phần mềm nghe lén." }
      ]
    },
    {
      title: "5. CAM KẾT & KHẲNG ĐỊNH",
      items: [
        { label: "Từ khóa", content: "Cam kết, đảm bảo, dứt điểm, chắc chắn, 100%, không tái phát, tận gốc, khỏi ngay lập tức,..." }
      ]
    },
    {
      title: "6. BẠO LỰC & CHẤT CẤM",
      items: [
        { label: "Chất cấm", content: "Thuốc lá, đạn dược, súng đạn, dao kiếm, thuốc nổ, bom, pháo, ma túy, cần sa." },
        { label: "Hành vi", content: "Bắt cóc, tống tiền, sát hại, sát thủ, thương tích, bạo lực, biểu tình, săn bắn, tấn công, trộm cắp." },
        { label: "Pháp luật", content: "Gian lận, lừa đảo, cờ bạc, làm giả, rửa tiền, hối lộ, tham ô, trả thù." }
      ]
    },
    {
      title: "7. GIẢM CÂN / TẮM TRẮNG",
      items: [
        { label: "Từ khóa", content: "Tăng cân, giảm cân, giảm béo, giảm mỡ, tăng cơ, thu gọn dáng, bật tông, trắng ngay, kem trộn..." }
      ]
    },
    {
      title: "8. TRẺ EM & GIỚI TÍNH",
      items: [
        { label: "Người lớn", content: "Ảnh khỏa thân, đồ chơi tình dục, khiêu dâm, thoát y, khêu gợi, tư thế gợi dục, bộ phận sinh dục." },
        { label: "Nhạy cảm", content: "Mông, núm vú, hậu môn, thiên hướng tình dục, tự sướng." },
        { label: "Lưu ý", content: "Nóng bỏng, sexy, quyến rũ chàng... Từ 'Ngoan xinh yêu' có thể bị quét buôn người." }
      ]
    },
    {
      title: "9. GÂY THÙ GHÉT / PHÂN BIỆT",
      items: [
        { label: "Xúc phạm", content: "Vô dụng, vô năng, thượng đẳng, hạ đẳng, lập dị, mọi rợ, Bắc Kỳ, bọn dân tộc." },
        { label: "Chửi thề", content: "Các từ tục tĩu chỉ bộ phận sinh dục hoặc hành vi thô tục." }
      ]
    },
    {
      title: "10. ĐIỀU HƯỚNG & TƯƠNG TÁC",
      items: [
        { label: "Kêu gọi", content: "Like, comment, share, follow, thả tim, nhắn tin, inbox." },
        { label: "Mua bán", content: "Khuyến mãi, ưu đãi, tặng, miễn phí, free, free ship, 0đ." },
        { label: "Nền tảng", content: "TikTok, Zalo, Youtube (khi dùng điều hướng)." },
        { label: "Dịch vụ", content: "Khách hàng, bán hàng, đặt hàng, chốt đơn, xả hàng, thanh lý, vào link, click link." }
      ]
    }
  ];

  return (
    <div className={`p-8 ${theme.colors.background} min-h-screen`}>
      <div className="max-w-4xl mx-auto space-y-10 pb-20">
        <div className="text-center space-y-2">
          <h1 className={`text-4xl font-black ${theme.colors.textPrimary} tracking-tighter uppercase`}>Danh mục <span className="text-orange-600">VPCS</span></h1>
          <p className={`text-sm font-bold ${theme.colors.textSecondary} uppercase tracking-widest`}>Vi Phạm Chính Sách - Tài liệu tham khảo cho AI Content</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {sections.map((section, idx) => (
            <div key={idx} className={`${theme.colors.cardBackground} rounded-3xl border ${theme.colors.border} shadow-sm overflow-hidden animate-fadeIn`}>
              <div className={`px-6 py-4 ${theme.colors.buttonSecondary} flex justify-between items-center`}>
                <h3 className={`${theme.colors.textPrimary} font-black text-xs uppercase tracking-widest`}>{section.title}</h3>
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              </div>
              <div className={`p-6 divide-y ${theme.colors.borderLight}`}>
                {section.items.map((item, i) => (
                  <div key={i} className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <span className={`text-[10px] font-black ${theme.colors.textSecondary} uppercase tracking-tighter`}>{item.label}</span>
                    <p className={`md:col-span-3 text-xs font-bold ${theme.colors.textPrimary} leading-relaxed`}>{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={`bg-orange-50 border-2 border-orange-100 rounded-[2rem] p-8 text-center shadow-inner`}>
           <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mb-2">Lời khuyên đạo diễn</p>
           <p className="text-sm font-bold text-orange-900 leading-relaxed italic">
             "Khi tạo kịch bản, hãy tránh dùng các từ khẳng định 100% hoặc các từ nhạy cảm liên quan đến bệnh lý. Hãy dùng ngôn từ kể chuyện, chia sẻ trải nghiệm để AI lách luật tốt nhất."
           </p>
        </div>
      </div>
    </div>
  );
};

export default VPCS;
