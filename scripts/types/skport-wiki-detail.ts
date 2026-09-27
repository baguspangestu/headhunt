/** Fields shared by operator, weapon, and gear detail responses. */
export interface SKPortWikiDetailResponse {
  code: number;
  data: {
    item: {
      itemId: string;
    };
  };
}
