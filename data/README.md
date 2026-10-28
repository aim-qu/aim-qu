# data

READMEの絵とゲームが読むデータです。

- `stars.json`：[HYG Database v4.1](https://github.com/astronexus/HYG-Database)（David Nash、CC BY-SA 4.0）から、7等より明るい星15,598個を抜き出したものです。赤経・赤緯・等級・色指数だけを残し、明るい星には名前・星座・バイエル符号・HIP番号も付けています。元のデータと同じCC BY-SA 4.0で配布します。
- `glyphs.json`：七十二候の名前・読み・節気に使う237字の輪郭です。[Noto Serif JP](https://fonts.google.com/noto/specimen/Noto+Serif+JP)から取り出したもので、SIL Open Font License 1.1に従います。全文は`OFL-NotoSerifJP.txt`にあります。字を足す時は`scripts/live/glyphs.mjs`で作り直します。
- `kou72.json`：七十二候（略本暦）の名前と読みです。長い読みは`br`の位置で二行に分けます。
- `go.json`：「石を返す」の盤面と棋譜です。GitHub Actionsが一手ごとに書き換えます。
