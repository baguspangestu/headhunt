import type { SKPortWikiDetailResponse } from './skport-wiki-detail';

export interface SKPortWikiDetailWeapon extends SKPortWikiDetailResponse {
  data: {
    item: {
      itemId: string;
      tagIds: string[];
      document: Document;
    };
  };
}

export interface Document {
  chapterGroup: {
    widgets: { id: string }[];
  }[];
  widgetCommonMap: Record<
    string,
    { tabDataMap: Record<string, { content?: string }> } | undefined
  >;
  documentMap: Record<
    string,
    { blockMap: Record<string, WikiBlock | undefined> } | undefined
  >;
}

interface WikiBlock {
  text?: {
    inlineElements: RawInlineElement[];
  };
  table?: {
    rowIds: string[];
    columnIds: string[];
    cellMap: Record<string, { childIds: string[] } | undefined>;
  };
}

interface RawInlineElement {
  kind: string;
  text?: { text: string };
  bold?: boolean;
  underline?: boolean;
  color?: string;
  entry?: {
    id: string;
    showType: string;
    count: string;
  };
}

export interface InlineElement extends RawInlineElement {
  text: { text: string };
}
