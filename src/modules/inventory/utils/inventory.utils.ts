export const withAvailable = <
  T extends {
    quantity: number;
    reservedQuantity: number;
  },
>(
  inventory: T,
) => {
  const { quantity, reservedQuantity, ...rest } = inventory;

  return {
    ...rest,
    quantity,
    reservedQuantity,
    available: quantity - reservedQuantity,
  };
};
