export const slugifyHeading = (text) =>
  text.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-鿿-]/g, '')
    .replace(/-+/g, '-');

export const addHeadingIds = (html) =>
  html.replace(/<h([23])(?: [^>]*)?>([^]*?)<\/h\1>/gi, (_, level, inner) => {
    const id = slugifyHeading(inner.replace(/<[^>]+>/g, ''));
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

export const stripLeadingHeading = (content) => {
  const lines = content.split('\n');
  let index = 0;
  while (index < lines.length && lines[index].trim() === '') index++;
  if (index < lines.length && /^#{1,6}\s/.test(lines[index])) lines.splice(index, 1);
  return lines.join('\n');
};

export const parseArticleOutline = (content) => {
  const outline = [];
  for (const line of content.split('\n')) {
    const levelTwo = line.match(/^## (.+)/);
    const levelThree = line.match(/^### (.+)/);
    if (levelTwo) {
      const text = levelTwo[1].trim();
      outline.push({ level: 2, text, id: slugifyHeading(text) });
    } else if (levelThree) {
      const text = levelThree[1].trim();
      outline.push({ level: 3, text, id: slugifyHeading(text) });
    }
  }
  return outline;
};
