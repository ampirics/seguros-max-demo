// Tipos TypeScript para la configuración CMS de la tienda

export interface StoreInfo {
  id: string;
  name: string;
  slogan: string;
  description: string;
  logo?: string;
  logoSmall?: string;
  whatsapp?: string;
  phone?: string;
}

export interface PromotionBar {
  id: string;
  text: string;
  backgroundColor: string;
  textColor: string;
  icon: string;
  isActive: boolean;
}

export interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  cta: string;
  order: number;
}

export interface FeaturedSection {
  id: string;
  title: string;
  subtitle: string;
  limit: number;
  isActive: boolean;
}

export interface CategorySection {
  id: string;
  title: string;
  subtitle: string;
  isActive: boolean;
}

export interface ProductSection {
  id: string;
  title: string;
  subtitle: string;
  allCategoriesTitle: string;
  loadingText: string;
  noProductsTitle: string;
  noProductsSubtitle: string;
  endOfCatalogTitle: string;
  endOfCatalogSubtitle: string;
  isActive: boolean;
}

export interface FooterLink {
  id: string;
  title: string;
  url: string;
  category: string;
}

export interface FooterSocial {
  id: string;
  platform: string;
  url: string;
  icon: string;
}

export interface FooterNewsletter {
  title: string;
  subtitle: string;
  placeholder: string;
  buttonText: string;
  isActive: boolean;
}

export interface Footer {
  id: string;
  storeName: string;
  description: string;
  links: FooterLink[];
  socialMedia: FooterSocial[];
  newsletter: FooterNewsletter;
  isActive: boolean;
}

export interface StoreConfig {
  storeInfo: StoreInfo;
  promotionBanner: PromotionBar;
  heroSlides: HeroSlide[];
  featuredSection: FeaturedSection;
  categorySection: CategorySection;
  productSection: ProductSection;
  footer: Footer;
  enable_bug_report_button?: boolean;
  disable_sap_validation?: boolean;
  whatsapp_phone?: string;
  
  // Llaves Ofuscadas (Fase 1 Security)
  _feat_br?: boolean;
  _enforce_sap?: boolean;
  lastUpdated: string;
}
