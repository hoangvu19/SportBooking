import React from 'react';
import * as Icons from 'lucide-react';

export default function GiftsBar({ isBroadcasting, likes, sendLike, sendGift }) {
  return (
    <div className="gifts-bar">
      {!isBroadcasting ? (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontWeight:700,fontSize:14}}>Gifts</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button onClick={sendLike} title='Like' style={{background:'transparent',border:'none',cursor:'pointer'}}><Icons.Heart size={18} color='#ff2d55' /></button>
              <div style={{fontWeight:700}}>{likes}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,overflowX:'auto'}}>
            {['Hoa hồng','Yêu bạn','Bắn tim','Bánh sinh nhật','Bí ngô'].map((g,i)=> (
              <button key={i} className='gift-item' onClick={() => sendGift(g)}>{g}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{marginLeft:8,color:'#cbd5e1'}}>Bạn đang là người phát trực tiếp — gifts bị ẩn</div>
        </div>
      )}
    </div>
  );
}
