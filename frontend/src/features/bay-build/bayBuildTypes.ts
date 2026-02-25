export interface BayBuildParams {
  baysX: number; // 1-5, number of bays in X direction
  baysZ: number; // 1-5, number of bays in Z direction
  bayWidthX: number; // 10-40 ft, bay spacing in X
  bayWidthZ: number; // 10-40 ft, bay spacing in Z
  stories: number; // 1-10, number of stories
  storyHeight: number; // 10-20 ft, uniform story height
  material: 'steel' | 'concrete';
  diaphragms: boolean;
  baseType: 'fixed' | 'isolated';
}

export const DEFAULT_BAY_BUILD_PARAMS: BayBuildParams = {
  baysX: 2,
  baysZ: 2,
  bayWidthX: 20,
  bayWidthZ: 20,
  stories: 2,
  storyHeight: 15,
  material: 'steel',
  diaphragms: true,
  baseType: 'fixed',
};
