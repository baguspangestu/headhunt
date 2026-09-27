export interface SKPortWikiCatalog {
  code: number;
  data: {
    catalog: {
      id: string;
      typeSub: {
        id: string;
        items: {
          itemId: string;
          name: string;
        }[];
      }[];
    }[];
  };
}
