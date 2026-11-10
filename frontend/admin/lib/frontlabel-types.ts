// types for FrontLabel
export interface FrontLabel {
  id: number;
  code: string;
  description?: string;
  group_id?: string | null;
  idparent?: number | null;
  value1?: string | null;
  value2?: string | null;
  value3?: string | null;
  value4?: string | null;
  value5?: string | null;
  // agrega aquí otros campos según el modelo backend
}

export interface FrontLabelCreate {
  code: string;
  description?: string;
  group_id?: string | null;
  idparent?: number | null;
  value1?: string | null;
  value2?: string | null;
  value3?: string | null;
  value4?: string | null;
  value5?: string | null;
}

export interface FrontLabelUpdate {
  description?: string;
  group_id?: string | null;
  idparent?: number | null;
  value1?: string | null;
  value2?: string | null;
  value3?: string | null;
  value4?: string | null;
  value5?: string | null;
}

export interface PaginatedFrontLabel {
  items: FrontLabel[];
  total: number;
  skip: number;
  limit: number;
}
