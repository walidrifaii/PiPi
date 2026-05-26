export type ProductOptionChoiceView = {
  id: string;
  name: string;
  nameAr: string | null;
  priceModifier: number;
  sortOrder: number;
  isActive: boolean;
};

export type ProductOptionGroupView = {
  id: string;
  name: string;
  nameAr: string | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  choices: ProductOptionChoiceView[];
};

export type SelectedOptionSnapshot = {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceName: string;
  priceModifier: number;
};
