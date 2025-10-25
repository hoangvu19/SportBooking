import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/hooks";
import PostCard from "../../components/Social/PostCard";
import Loading from "../../components/Shared/Loading";
import { postAPI } from "../../utils/api";
import { ArrowLeft } from "lucide-react";

const PostDetail = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const { t } = useI18n();

  React.useEffect(() => {
    setLoading(true);
    postAPI.getById(postId)
      .then(res => {
        if (res.success && res.data) {
            setPost(prev => ({ ...prev, ...res.data }));
          } else {
            setError(t('post.notFound', 'Post not found'));
          }
      })
        .catch(() => setError(t('post.loadError', 'Error loading post')))
      .finally(() => setLoading(false));
  }, [postId, t]);

  if (loading) return <Loading />;
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {t('common.back', 'Back')}
        </button>
      </div>
    </div>
  );
  if (!post) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-2xl mx-auto px-4">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-4 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">{t('common.back','Back')}</span>
        </button>
        
        {/* Post Card */}
        <PostCard post={post} />
      </div>
    </div>
  );
};

export default PostDetail;
