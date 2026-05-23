/**
 * 型定義の再エクスポート
 * spec/domain.ts が SSOT。本ファイルは src/ 内での import パスを短くするための窓口。
 */

export type {
  CaaFExtractionResult,
  CaaFExtractedItem,
  CurrentlyOut,
  Employee,
  IndividualUnit,
  Item,
  ItemCategory,
  ItemMovement,
  Location,
  LocationKind,
  MovementType,
  Signal,
  TrackingType,
  UnitCurrentStatus,
} from "@spec/domain";

// Re-export Zod schemas for runtime validation
export {
  CaaFExtractionResult as CaaFExtractionResultSchema,
  CaaFExtractedItem as CaaFExtractedItemSchema,
  CurrentlyOut as CurrentlyOutSchema,
  Employee as EmployeeSchema,
  IndividualUnit as IndividualUnitSchema,
  Item as ItemSchema,
  ItemMovement as ItemMovementSchema,
  Location as LocationSchema,
  Signal as SignalSchema,
  UnitCurrentStatus as UnitCurrentStatusSchema,
} from "@spec/domain";
