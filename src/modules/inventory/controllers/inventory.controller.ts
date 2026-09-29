import type { RequestHandler } from "express";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import type {
  AddStockDto,
  InitializeInventoryDto,
  RemoveStockDto,
} from "../dto/inventory.dto.js";
import type { InventoryService } from "../services/inventory.service.js";

type InventoryControllerDependencies = {
  inventoryService: InventoryService;
};

export type InventoryController = {
  initialize: RequestHandler;
  getByProductId: RequestHandler;
  getById: RequestHandler;
  addStock: RequestHandler;
  removeStock: RequestHandler;
  getMovements: RequestHandler;
};

export const createInventoryController = ({
  inventoryService,
}: InventoryControllerDependencies): InventoryController => {

  const initialize = asyncHandler(async (req, res) => {
    const dto: InitializeInventoryDto = req.body;

    const inventory = await inventoryService.initialize(dto.productId);

    res.status(201).json({
      success: true,
      data: inventory,
    });
  });

  const getByProductId = asyncHandler(async (req, res) => {
    const productId = req.params.productId;

    if (typeof productId !== "string" || !productId) {
      throw new BadRequestError("Product ID is required");
    }

    const inventory = await inventoryService.getByProductId(productId);

    res.status(200).json({
      success: true,
      data: inventory,
    });
  });

  const getById = asyncHandler(async (req, res) => {
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

  const addStock = asyncHandler(async (req, res) => {
    const productId = req.params.productId;
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

  const removeStock = asyncHandler(async (req, res) => {
    const productId = req.params.productId;
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

  const getMovements = asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (typeof id !== "string" || !id) {
      throw new BadRequestError("Inventory ID is required");
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
