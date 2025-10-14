import React from 'react';
import DEFAULT_AVATAR from '../../utils/defaults';

export default function CommentsPanel({ comments, commentsRef, commentText, setCommentText, sendComment, showEmoji, setShowEmoji, unreadCount, isNearBottom, onScroll }) {
  return (
    <div className="ls-right">
      <div className='right-header'>
        <div><strong>Bình luận</strong></div>
      </div>
      <div className='comments-list' ref={commentsRef} onScroll={onScroll}>
        {comments.length === 0 ? <div style={{color:'#9aa3b2'}}>Không có bình luận</div> : (
          comments.map((c, i) => {
            const author = c.Author || c.comment?.Author || {};
            const text = c.Content || c.comment?.Content || (c.comment?.text || '');
            const time = new Date(c.CreatedDate || c.comment?.CreatedDate || Date.now());
            const name = author.FullName || author.Username || 'Người dùng';
            return (
              <div key={i} className='comment-item'>
                <img src={author.AvatarUrl || DEFAULT_AVATAR} className='comment-avatar' />
                <div style={{flex:1}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div className='comment-author'>{name}</div>
                    <div style={{fontSize:12,color:'#9aa3b2'}}>{time.toLocaleTimeString()}</div>
                  </div>
                  <div className='comment-bubble' style={{marginTop:6}}>{text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className='comment-input'>
        <button className='emoji-btn' onClick={() => setShowEmoji(s => !s)} title='Emoji'>😊</button>
        <input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder='Nhập bình luận...' />
        <button onClick={sendComment} style={{background:'#6366f1',color:'#fff',padding:'8px 12px',borderRadius:8}}>Gửi</button>
        {showEmoji && (
          <div className='emoji-picker'>
            {['🙂','😂','😍','😭','🔥','👏','🎉','❤️'].map((em,i) => (
              <button key={i} onClick={() => { setCommentText(t => t + em); setShowEmoji(false); }}>{em}</button>
            ))}
          </div>
        )}
      </div>
      {!isNearBottom && unreadCount > 0 && (
        <div className='new-comments-pill' onClick={() => { if (commentsRef.current) { commentsRef.current.scrollTop = commentsRef.current.scrollHeight; } }}>
          {unreadCount} new
        </div>
      )}
    </div>
  );
}
