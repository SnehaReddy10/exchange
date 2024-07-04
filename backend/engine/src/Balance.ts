export type Balance = {
  [key: string]: {
    available: number;
    locked: number;
  };
};
