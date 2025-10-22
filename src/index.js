import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';  // 스타일 파일을 추가할 수 있습니다.
import App from './App';  // App 컴포넌트 임포트

// React 앱의 루트 컴포넌트를 렌더링합니다.
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')  // index.html 파일의 <div id="root"></div>에 렌더링
);
