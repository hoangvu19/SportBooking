import React, { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { reportAPI } from '../../utils/reportAPI';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n/hooks';

const ReportModal = ({ visible, onClose, contentType, contentId, contentPreview = '' }) => {
  const { t } = useI18n();
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Report reasons based on Facebook-style categories
  const reportReasons = [
    {
      category: t('report.violenceCategory') || 'Vấn đề liên quan đến người dưới 18 tuổi',
      reasons: [
        t('report.underageViolence') || 'Bạo lực hoặc nguy hiểm đến trẻ em',
        t('report.underageExploitation') || 'Bóc lột hoặc lạm dụng trẻ em'
      ]
    },
    {
      category: t('report.abuseCategory') || 'Bắt nạt, quấy rối hoặc lăng mạ/dùng ngược đãi',
      reasons: [
        t('report.bullying') || 'Bắt nạt hoặc quấy rối',
        t('report.hateSpeech') || 'Phát ngôn thù ghét',
        t('report.violence') || 'Bạo lực hoặc tổ chức nguy hiểm'
      ]
    },
    {
      category: t('report.selfHarmCategory') || 'Tự tử hoặc tự hại bản thân',
      reasons: [
        t('report.selfHarm') || 'Tự tử hoặc tự hại bản thân',
        t('report.eatingDisorder') || 'Rối loạn ăn uống'
      ]
    },
    {
      category: t('report.fraudCategory') || 'Nội dung mạng tình bạo lực, thù ghét hoặc gây phiền toái',
      reasons: [
        t('report.spam') || 'Spam',
        t('report.scam') || 'Lừa đảo hoặc gian lận',
        t('report.falseInfo') || 'Thông tin sai sự thật'
      ]
    },
    {
      category: t('report.adultContentCategory') || 'Bán hoặc quảng cáo mặt hàng bị hạn chế',
      reasons: [
        t('report.drugsSales') || 'Thuốc, ma túy',
        t('report.weaponsSales') || 'Vũ khí, đạn dược'
      ]
    },
    {
      category: t('report.privacyCategory') || 'Nội dung người lớn',
      reasons: [
        t('report.nudity') || 'Khỏa thân hoặc hành vi tình dục',
        t('report.sexualExploitation') || 'Bóc lột tình dục'
      ]
    },
    {
      category: t('report.intellectualCategory') || 'Bán hoặc quảng cáo mặt hàng bị hạn chế',
      reasons: [
        t('report.restrictedGoods') || 'Hàng hóa bị hạn chế hoặc bất hợp pháp'
      ]
    },
    {
      category: t('report.privacyViolation') || 'Quyền sở hữu trí tuệ',
      reasons: [
        t('report.copyrightViolation') || 'Vi phạm bản quyền',
        t('report.trademarkViolation') || 'Vi phạm thương hiệu'
      ]
    },
    {
      category: t('report.other') || 'Tôi không muốn xem nội dung này',
      reasons: [
        t('report.notInterested') || 'Không quan tâm'
      ]
    }
  ];

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error(t('report.selectReason') || 'Vui lòng chọn lý do báo cáo');
      return;
    }

    setSubmitting(true);
    try {
      // Normalize contentId to a primitive (string/number) to avoid sending objects
      const normalizeContentId = (id) => {
        if (id === null || id === undefined) return id;
        if (typeof id === 'string' || typeof id === 'number') return id;
        // common shapes: {_id: '...'} or {PostID: 123}
        if (typeof id === 'object') {
          if (id._id) return id._id;
          if (id.PostID) return id.PostID;
          if (id.PostId) return id.PostId;
          if (id.id) return id.id;
          if (id.ID) return id.ID;
          try { return JSON.stringify(id); } catch { return String(id); }
        }
        return id;
      };

      const normalizedContentId = normalizeContentId(contentId);
      console.debug('Reporting', { contentType, contentId: normalizedContentId, reason: selectedReason });

      const result = await reportAPI.create(contentType, normalizedContentId, selectedReason, description);
      if (result.success) {
        toast.success(result.message || t('report.success') || 'Báo cáo đã được gửi thành công');
        onClose();
        setSelectedReason('');
        setDescription('');
      } else {
        toast.error(result.message || t('report.failed') || 'Gửi báo cáo thất bại');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      // Prefer server-provided message if available
      const msg = (error && error.message) ? error.message : (error && error.response && error.response.data && error.response.data.message) ? error.response.data.message : t('report.error') || 'Có lỗi xảy ra khi gửi báo cáo';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            {t('report.title') || 'Báo cáo'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview */}
        {contentPreview && (
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="text-sm text-gray-600 mb-1">{t('report.contentPreview') || 'Nội dung báo cáo'}:</p>
            <p className="text-sm line-clamp-2">{contentPreview}</p>
          </div>
        )}

        {/* Main Question */}
        <div className="px-4 py-3 border-b">
          <h3 className="font-medium mb-2">{t('report.question') || 'Tại sao bạn báo cáo bài viết này?'}</h3>
          <p className="text-sm text-gray-600">
            {t('report.helpText') || 'Nếu bạn nhận thấy ai đó đang gặp nguy hiểm, đừng chần chừ mà hãy tìm ngay sự giúp đỡ trước khi báo cáo với Facebook.'}
          </p>
        </div>

        {/* Report Reasons */}
        <div className="px-4 py-2">
          {reportReasons.map((group, groupIdx) => (
            <div key={groupIdx} className="mb-2">
              {group.reasons.map((reason, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedReason(reason)}
                  className={`flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-gray-50 rounded-lg ${
                    selectedReason === reason ? 'bg-blue-50 border border-blue-300' : ''
                  }`}
                >
                  <span className="text-sm">{reason}</span>
                  {selectedReason === reason && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
              {groupIdx < reportReasons.length - 1 && <div className="border-b my-2"></div>}
            </div>
          ))}
        </div>

        {/* Optional Description */}
        {selectedReason && (
          <div className="px-4 py-3 border-t">
            <label className="block text-sm font-medium mb-2">
              {t('report.additionalInfo') || 'Thông tin bổ sung (không bắt buộc)'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('report.descriptionPlaceholder') || 'Mô tả chi tiết lý do báo cáo...'}
              className="w-full border rounded-lg p-2 text-sm resize-none"
              rows={3}
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            {t('common.cancel') || 'Hủy'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedReason || submitting}
            className={`flex-1 px-4 py-2 rounded-lg text-white ${
              !selectedReason || submitting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {submitting ? (t('report.submitting') || 'Đang gửi...') : (t('report.submit') || 'Gửi báo cáo')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
