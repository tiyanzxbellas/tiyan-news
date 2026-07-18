export interface NewsItem {
  id: string;
  title: string;
  link: string;
  image: string;
  category: string;
  source: string;
  publishedAt?: string | null;
  description?: string;
}
