import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  return rss({
    title: '데크센터 블로그',
    description: '목재·합성목·알루미늄 데크 등 외장 데크재 정보',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt,
      link: `/blog/${post.slug}/`,
    })),
    customData: `<language>ko</language>`,
  });
}
