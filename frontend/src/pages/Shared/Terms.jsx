import React, { useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import TRANSLATIONS from '../../i18n/translations';

const Terms = () => {
  const { t, lang } = useI18n();
  const [localLang, setLocalLang] = useState(lang || 'en');
  const contentRef = useRef(null);

  const localT = (path, fallback) => {
    if (!path) return fallback || '';
    const parts = path.split('.');
    let cur = TRANSLATIONS[localLang] || TRANSLATIONS.en;
    for (let p of parts) {
      if (!cur) return fallback || path;
      cur = cur[p];
    }
    return cur || fallback || path;
  };

  const handlePrint = () => {
    if (!contentRef.current) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Vui lòng cho phép popup để in / lưu PDF');
      return;
    }

    // Clone current styles to the print window
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n');

    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Terms</title>${styles}</head><body>`);
    printWindow.document.write(contentRef.current.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();

    // Wait a moment for resources to load then call print
    setTimeout(() => {
      try {
        printWindow.print();
        // Keep window open so user can cancel print/save; close after a short delay optionally
        // printWindow.close();
      } catch (e) {
        console.error('Print failed', e);
      }
    }, 500);
  };
  const updated = new Date().toLocaleDateString();
  const supportEmail = 'support@wherewesport.example';

  return (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileIcon />
            <div>
              <h2 className="text-2xl font-semibold">{localT('terms.title', t('menu.terms', 'Chính sách & Điều khoản'))}</h2>
              <p className="text-sm text-gray-500">{localT('terms.policyIntro', '')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Pill language switch */}
            <div className="relative inline-flex items-center rounded-full border px-1 py-1 bg-white">
              <button
                aria-label="Tiếng Việt"
                onClick={() => setLocalLang('vi')}
                className={`relative z-10 px-3 py-1 rounded-full text-sm transition-colors ${localLang === 'vi' ? 'bg-indigo-600 text-white shadow' : 'text-gray-700'}`}>
                VI
              </button>
              <button
                aria-label="English"
                onClick={() => setLocalLang('en')}
                className={`relative z-10 px-3 py-1 rounded-full text-sm transition-colors ${localLang === 'en' ? 'bg-indigo-600 text-white shadow' : 'text-gray-700'}`}>
                EN
              </button>
            </div>

            {/* Large purple save-as-pdf button */}
            <button onClick={handlePrint} className="flex items-center justify-center w-44 h-12 rounded-lg bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 px-4">
              <span className="text-sm font-medium">{localT('terms.saveAsPdf', 'Save as PDF')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 px-4 py-6">
          <main className="lg:col-span-1">
            <div ref={contentRef} className="prose prose-sm sm:prose lg:prose-lg max-w-none text-gray-800">
              <section>
                <div className="mb-4" />
                <h3 className="font-extrabold">{localT('terms.policyTitle', 'Chính sách sử dụng dịch vụ')}</h3>
                <p className="mt-2">{localT('terms.policyIntro', 'WhereWeSport chỉ là nền tảng kết nối giữa khách hàng, chủ sân và người chơi. Chúng tôi không chịu trách nhiệm cho các tình huống phát sinh trong đời thực giữa các bên.')}</p>
                <div>
                  <p className="font-medium mt-3">{localT('terms.policyExamplesHeading', 'Ví dụ minh họa:')}</p>
                  <ul>
                    <li>{localT('terms.policyExamples.a')}</li>
                    <li>{localT('terms.policyExamples.b')}</li>
                    <li>{localT('terms.policyExamples.c')}</li>
                  </ul>
                </div>
              </section>

              <section>
                <div className="mb-4" />
                <h3 className="font-extrabold">{localT('terms.termsTitle', 'Điều khoản sử dụng')}</h3>
                <ul>
                  <li>{localT('terms.termsList.1')}</li>
                  <li>{localT('terms.termsList.2')}</li>
                  <li>{localT('terms.termsList.3')}</li>
                  <li>{localT('terms.termsList.4')}</li>
                  <li>{localT('terms.termsList.5')}</li>
                </ul>
              </section>

              <section>
                <div className="mb-4" />
                <h3 className="font-extrabold">{localT('terms.notesTitle', 'Ghi chú thêm')}</h3>
                <p className="mt-2">{localT('terms.notesIntro', 'Chúng tôi khuyến nghị người dùng:')}</p>
                <ol>
                  <li>{localT('terms.notesList.1')}</li>
                  <li>{localT('terms.notesList.2')}</li>
                  <li>{localT('terms.notesList.3')}</li>
                </ol>
              </section>
            </div>

            {/* Footer moved to the end of the article to appear after the notes */}
            <div className="px-4 pb-8">
                <div className="mt-6 border-t pt-6 text-center text-sm text-gray-600">
                  <p className="mb-2">{localT('terms.footer.updated', `Last updated: ${updated}`).replace('{date}', updated)}</p>
                  <p>{localT('terms.footer.contact', `Support contact: ${supportEmail}`).replace('{email}', supportEmail)}</p>
                </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

 
function FileIcon() {
  return (
    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 2a1 1 0 00-1 1v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V8l-5-5H9z" />
      </svg>
    </div>
  );
}

export default Terms;
