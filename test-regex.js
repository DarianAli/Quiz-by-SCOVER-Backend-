const text = `![](/var/folders/1k/qc7m9b9j3ql35cjh1yglqh680000gn/T/quiz-import-media-G7klgK/media/image1.png){width="3.660378390201225in"\nheight="2.168208661417323in"}`;
const baseSafe = "image1\\.png";
const urlRegex = new RegExp(`!\\[([^\\]]*)\\]\\([^)]*?${baseSafe}\\)(\\{[^}]*\\})?`, "g");
console.log(text.replace(urlRegex, `![$1](/question_image/REPLACED.png)$2`));
