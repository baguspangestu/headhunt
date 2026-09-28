export type Banners = Record<string, Banner>;

export type Banner = {
  id: string;
  name: string;
  image: string;
  rateup: string;
  rotate?: string[];
  featured?: string[];
  startTime?: number;
  endTime?: number;
};
