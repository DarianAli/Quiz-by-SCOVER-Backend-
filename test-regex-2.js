const text = `![alt](http://localhost:9000/import/SESSION/media/image1.png){width="3.66in"}`;
const baseSafe = "image1\\.png";
const urlRegex = new RegExp(`!\\[([^\\]]*)\\]\\([^)]*?${baseSafe}\\)(\\{[^}]*\\})?`, "g");
console.log(text.replace(urlRegex, `![$1](/question_image/REPLACED.png)$2`));
