# Break Sync

iPhone / Android で同期できる個人用休憩時間管理PWAです。

## 機能
- 休憩開始 / 終了
- 休憩中のリアルタイムタイマー
- 今日の合計休憩時間
- 1日の休憩上限と残り時間
- 今日の履歴
- iPhone / Android間同期（Firestore）
- Firebase未設定時はローカル保存で動作確認可能
- PWA対応（ホーム画面追加）

## Firebase設定
1. Firebase Consoleでプロジェクト作成
2. Firestore Databaseを作成
3. Webアプリを追加
4. firebase-config.example.js を firebase-config.js にコピー
5. Firebaseの設定値を貼り付け
6. Firestore Rulesを個人利用用に設定

### 最小の動作確認用ルール
開発確認だけなら以下（公開状態になるため長期利用非推奨）:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /breakrooms/{roomId} {
      allow read, write: if true;
    }
  }
}
```

本番ではFirebase Authenticationを追加して自分だけアクセス可能にするのがおすすめです。

## 起動
HTTPS環境に配置してください。GitHub Pages / Firebase Hosting / Netlify / Vercel などで動作します。

ローカル確認例:
`python -m http.server 8080`

## 同期方法
両端末で同じ「共有キー」を入力して保存すると同じFirestoreドキュメントを購読します。
