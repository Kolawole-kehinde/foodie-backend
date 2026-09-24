import type { RequestHandler } from "express";
import type { InventoryService } from "../services/inventory.service.js";
import type {
  AddStockDto,
  InitializeInventoryDto,
  RemoveStockDto,
} from "../dto/inventory.dto.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";

type InventoryControllerDependencies = {
  inventoryService: InventoryService;
};

export const createInventoryController = ({
  inventoryService,
}: InventoryControllerDependencies) => {
  const initialize: RequestHandler = asyncHandler(async (req, res) => {
    const dto: InitializeInventoryDto = req.body;

    const inventory = await inventoryService.initialize(dto.productId);

    res.status(201).json({
      success: true,
      data: inventory,
    });
  });

  const getByProductId: RequestHandler = asyncHandler(async (req, res) => {
    const productId = req.params.id;

    if (typeof productId !== "string" || !productId) {
      throw new BadRequestError("Product ID is required");
    }

    const inventory = await inventoryService.getByProductId(productId);

    res.status(200).json({
      success: true,
      data: inventory,
    });
  });

  const getById: RequestHandler = asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (typeof id !== "string" || !id) {
      throw new BadRequestError("Product ID is required");
    }

    const inventory = await inventoryService.getById(id);

    res.status(200).json({
      success: true,
      data: inventory,
    });
  });

  const addStock: RequestHandler = asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const dto: AddStockDto = req.body;

    if (typeof productId !== "string" || !productId) {
      throw new BadRequestError("Product ID is required");
    }

    const inventory = await inventoryService.addStock(
      productId,
      dto.quantity,
      dto.reason,
    );

    res.status(200).json({
      success: true,
      data: inventory,
    });
  });

  const removeStock: RequestHandler = asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const dto: RemoveStockDto = req.body;

    if (typeof productId !== "string" || !productId) {
      throw new BadRequestError("Product ID is required");
    }

    const inventory = await inventoryService.removeStock(
      productId,
      dto.quantity,
      dto.reason,
    );

    res.status(200).json({
      success: true,
      data: inventory,
    });
  });

  const getMovements: RequestHandler = asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (typeof id !== "string" || !id) {
      throw new BadRequestError("Product ID is required");
    }

    const movements = await inventoryService.getMovements(id);

    res.status(200).json({
      success: true,
      data: movements,
    });
  });

  return {
    initialize,
    getByProductId,
    getById,
    addStock,
    removeStock,
    getMovements,
  };
};

export type InventoryController = ReturnType<typeof createInventoryController>;
