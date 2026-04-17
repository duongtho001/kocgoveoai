
import React from 'react';
import { motion } from 'framer-motion';
import { theme } from '../constants/colors';
import { 
  MessageSquare,
  Zap, 
  Settings, 
  Video, 
  Users, 
  ShoppingBag, 
  Footprints, 
  Camera, 
  Brain, 
  BookOpen, 
  Eye, 
  EyeOff,
  Layers, 
  Link as LinkIcon, 
  Clock, 
  Gamepad2, 
  Type,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const FeatureIntroModule: React.FC = () => {
  const features = [
    {
      id: 'chatbot',
      title: 'Chatbot Studio',
      description: 'Tự động tạo kịch bản hoặc phân tích, bóc tách cấu trúc của video gốc (từ hook mở đầu, nhịp nội dung, điểm cao trào cho tới CTA), sau đó chuẩn hóa thành một “bộ khung nội dung” có thể tái sử dụng ngay lập tức trong các module khác. Giúp bạn có thể sản xuất hàng loạt nội dung đồng nhất về chất lượng nhưng vẫn đa dạng về góc tiếp cận.',
      icon: <MessageSquare className="w-6 h-6" />,
      color: 'bg-blue-500',
    },
    {
      id: 'koc2',
      title: 'KOC Review (Viral Hook)',
      description: 'Giữ chân người xem ngay từ những giây đầu tiên với hệ thống hơn 100 câu Hook kinh điển và bố cục kịch bản đã được chứng minh hiệu quả trên TikTok. Module này cho phép bạn tùy chỉnh sâu từ tư thế nhân vật (Pose), góc máy (Camera Angle) đến việc đồng bộ khuôn mặt và trang phục mẫu. AI sẽ tự động phân bổ sản phẩm vào từng cảnh quay một cách tự nhiên, tạo ra kịch bản review có chiều sâu, tính thuyết phục cao và tăng khả năng chuyển đổi đơn hàng.',
      icon: <Zap className="w-6 h-6" />,
      color: theme.colors.primaryBg,
    },
    {
      id: 'nonface',
      title: 'Review Non-face',
      description: 'Bạn có thể làm video mà không cần lộ mặt. Chính xác, làm AI nhưng vẫn không muốn lộ mặt. Module review non-face sẽ tập trung tối đa vào các nội dung quay cận cảnh (Macro), thao tác tay (Hands-on) và trải nghiệm sử dụng thực tế của sản phẩm. AI sẽ mô tả chi tiết bề mặt, chất liệu và cách thức hoạt động, giúp người xem cảm nhận sản phẩm một cách chân thực nhất, từ đó xây dựng niềm tin và thúc đẩy hành vi mua hàng.',
      icon: <EyeOff className="w-6 h-6" />,
      color: 'bg-slate-600',
    },
    {
      id: 'nonface2',
      title: 'Review Cận Chân',
      description: 'Module chuyên biệt được thiết kế riêng cho ngành hàng thời trang giày dép, váy vóc... Hệ thống AI hiểu rõ các đặc tính quan trọng như form dáng, chất liệu da, độ êm ái của đế và các chi tiết gia công tinh xảo. Với các góc quay bám sát bước chân và bối cảnh sử dụng thực tế (đi bộ, chạy, phối đồ), module này giúp phô diễn trọn vẹn vẻ đẹp và công năng của từng loại sản phẩm, đáp ứng những yêu cầu khắt khe nhất của khách hàng.',
      icon: <Footprints className="w-6 h-6" />,
      color: 'bg-emerald-500',
    },
    {
      id: 'videopov',
      title: 'Kiến Thức - Dịch Vụ',
      description: 'Kiến Thức – Dịch Vụ là module chuyên tạo video AI dạng giới thiệu, giải thích và chia sẻ kinh nghiệm. Người dùng chỉ cần nhập thông tin về dịch vụ, quy trình hoặc câu chuyện thực tế, hệ thống sẽ tự động xây dựng kịch bản, nhân vật AI và video hoàn chỉnh để đăng lên các nền tảng. Đây là dạng video đang có tỉ lệ giữ chân cao trên TikTok, Reels và Shorts.',
      icon: <Eye className="w-6 h-6" />,
      color: 'bg-indigo-500',
    },
    {
      id: 'carousel',
      title: 'Ảnh Cuộn Tiktok',
      description: 'Tận dụng tối đa sức mạnh của định dạng ảnh cuộn (Carousel) đang cực kỳ viral trên TikTok và Instagram. Module này giúp bạn thiết kế các bộ slide ảnh có tính kể chuyện cao, dẫn dắt người xem đi từ vấn đề đến giải pháp một cách mượt mà. Với bố cục được tối ưu hóa cho hành vi vuốt của người dùng, bạn có thể truyền tải nhiều thông tin hơn, giữ chân người xem lâu hơn và tăng tỷ lệ tương tác (like, share, save) vượt trội.',
      icon: <Layers className="w-6 h-6" />,
      color: 'bg-pink-500',
    },
    {
      id: 'personification',
      title: 'Nhân Hóa Review',
      description: 'Đỉnh cao của sự sáng tạo với khả năng biến những sản phẩm vô tri thành những nhân vật có linh hồn và tính cách riêng biệt. Sử dụng 10 công thức tâm lý độc đáo, module này giúp bạn kể những câu chuyện thú vị, hài hước hoặc kịch tính về sản phẩm. Đây là vũ khí bí mật để tạo ra sự khác biệt hoàn toàn trên thị trường, giúp thương hiệu của bạn ghi dấu ấn đậm nét trong tâm trí khách hàng thông qua những nội dung thú vị. Phù hợp với các chủ đề sức khỏe, thực phẩm…',
      icon: <Brain className="w-6 h-6" />,
      color: 'bg-yellow-500',
    },
    {
      id: 'personification2',
      title: 'Nhân Hóa (Kiến thức)',
      description: 'Giải pháp tối ưu để truyền tải những kiến thức chuyên môn khô khan hoặc các thông số kỹ thuật phức tạp một cách sinh động và dễ tiếp thu. Bằng cách nhân hóa các khái niệm hoặc thành phần sản phẩm, AI sẽ tạo ra các cuộc đối thoại thông minh, giúp người xem hiểu rõ lợi ích cốt lõi của sản phẩm mà không cảm thấy bị ngợp bởi thông tin. Cực kỳ hiệu quả cho các ngành hàng sức khỏe, mỹ phẩm, đời sống… Bạn cũng có thể ứng dụng module này để tạo ra những video kiểu mẹ chồng dạy con dâu mới, mẹ dạy con học tiếng anh hay đối thoại giữa 2 nhân vật.',
      icon: <BookOpen className="w-6 h-6" />,
      color: 'bg-teal-500',
    },
    {
      id: 'fashiontracking',
      title: 'Fashion Tracking',
      description: 'Tạo ra những thước phim thời trang phong cách "Paparazzi" đầy nghệ thuật và sống động. Với 12 góc máy chuyên dụng (Spy Angles) từ góc thấp bám bước chân đến góc nhìn qua vai, module này giúp nhân vật của bạn di chuyển tự nhiên trong các bối cảnh phố thị hiện đại. Bạn có thể thay đổi hàng loạt trang phục trên cùng một gương mặt mẫu mà vẫn giữ vững tính nhất quán, giúp tiết kiệm tối đa chi phí thuê mẫu và quay phim chuyên nghiệp. Ví dụ bạn có thể làm 1 video trang phục 7 đi làm cho nàng công sở hay style đi dạo phố của chị em bánh bèo…',
      icon: <Camera className="w-6 h-6" />,
      color: 'bg-purple-500',
    },
    {
      id: 'timelapse',
      title: 'Timelapse (Tua nhanh)',
      description: 'Tạo ra sự tò mò và thỏa mãn thị giác (satisfying) thông qua hiệu ứng tua nhanh thời gian. Module này cực kỳ phù hợp để trình diễn các quá trình biến đổi cho 1 không gian nội ngoại thất.. Timelapse giúp nén những nội dung dài thành những thước phim ngắn gọn, kịch tính, giúp người xem có mối quan tâm đến ngách decor nội thất thấy được kết quả cuối cùng một cách nhanh chóng và ấn tượng.',
      icon: <Clock className="w-6 h-6" />,
      color: 'bg-orange-400',
    },
    {
      id: 'shopee8s',
      title: 'Shopee Video',
      description: 'Vũ khí đắc lực để thống lĩnh nền tảng Shopee Video với các đoạn clip ngắn 8-16 giây có tính chuyển đổi cực cao. Module tập trung vào việc phô diễn sản phẩm ngay từ giây đầu tiên, kết hợp với các hiệu ứng thị giác mạnh mẽ và lời kêu gọi hành động (CTA) thôi thúc. Được thiết kế đặc biệt để tương thích với thuật toán của Shopee, giúp tăng số lượng video của bạn mà vẫn đảm bảo chất lượng video.',
      icon: <Video className="w-6 h-6" />,
      color: 'bg-[#EE4D2D]',
    },
    {
      id: 'coverlink',
      title: 'Cover Link Shopee',
      description: 'Nếu bạn đang kiếm tiền từ nội dung trên các nền tảng mạng xã hội như facebook, instagram, thread hay facebook thì module này là 1 trợ thủ đắc lực giúp bạn chuyển đổi hàng loạt các đường link Affiliate của người khác thành của mình trong 1 nốt nhạc. Tiết kiệm thời gian và mang lại giá trị cực cao.',
      icon: <LinkIcon className="w-6 h-6" />,
      color: 'bg-cyan-500',
    },
    {
      id: 'dhbc',
      title: 'Đuổi Hình Bắt Chữ',
      description: 'Công cụ tuyệt vời để xây dựng cộng đồng và tăng tương tác hai chiều với khán giả. Bằng cách tạo ra các mini-game đuổi hình bắt chữ thông minh và hài hước liên quan đến sản phẩm, bạn không chỉ giúp khách hàng ghi nhớ thương hiệu một cách tự nhiên mà còn khuyến khích họ để lại bình luận, chia sẻ. Đây là cách hiệu quả nhất để "hâm nóng" kênh và tạo ra một lượng fan trung thành cho các chiến dịch bán hàng dài hạn.',
      icon: <Gamepad2 className="w-6 h-6" />,
      color: 'bg-rose-500',
    },
    {
      id: 'vuatv',
      title: 'Vua Tiếng Việt',
      description: 'Tạo nội dung thử thách tiếng Việt, giúp video của bạn trở nên thú vị và mang tính giáo dục.',
      icon: <Type className="w-6 h-6" />,
      color: 'bg-slate-700',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero Section removed */}

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
        {features.map((feature, index) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -5 }}
            className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-100 border border-slate-100 flex flex-col group transition-all"
          >
            <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg transform group-hover:rotate-6 transition-transform`}>
              {feature.icon}
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">
              {feature.title}
            </h3>
            <div className="text-slate-500 text-sm leading-relaxed whitespace-pre-line">
              {feature.description}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Conclusion Section removed */}

      <div className="mt-20 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] koc-studio-footer">
          AI CREATIVE ENGINE
        </p>
      </div>
    </div>
  );
};

export default FeatureIntroModule;

