-- ============================================================================
--  miniapps_tools seed data: power tools inventory
--  Generated: 2026-05-23
--  Source: CSV inventory (2025/12/28-29)
-- ============================================================================

BEGIN;

-- Item: 洗浄機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('洗浄機', 'JC-1513 KB', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '洗浄機'),
  1, NULL
);

-- Item: 高圧洗浄用ホースドラム
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('高圧洗浄用ホースドラム', 'HD 60', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホースドラム'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホースドラム'),
  2, NULL
);

-- Item: ポッキン延長ブレーカー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ポッキン延長ブレーカー', 'PBW-EK-T(防雨型)', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ポッキン延長ブレーカー'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ポッキン延長ブレーカー'),
  2, NULL
);

-- Item: 漏電ブレーカー PIPB-EK- T屋内型
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('漏電ブレーカー PIPB-EK- T屋内型', 'PIPB-EK- T屋内型', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '漏電ブレーカー PIPB-EK- T屋内型'),
  1, NULL
);

-- Item: モルタルミキサー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('モルタルミキサー', 'RL-MM80L', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'モルタルミキサー'),
  1, NULL
);

-- Item: 撹拌機（充電）
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('撹拌機（充電）', 'UT130D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '撹拌機（充電）'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '撹拌機（充電）'),
  2, NULL
);

-- Item: ホッパー付きエアレス
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ホッパー付きエアレス', 'AETFL54P0003', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ホッパー付きエアレス'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ホッパー付きエアレス'),
  2, NULL
);

-- Item: エアレス
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('エアレス', 'ABPFL14PK005', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エアレス'),
  1, NULL
);

-- Item: 撹拌機（有線） UT2204
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('撹拌機（有線） UT2204', 'UT2204', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '撹拌機（有線） UT2204'),
  1, NULL
);

-- Item: 撹拌機（有線） UT1305
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('撹拌機（有線） UT1305', 'UT1305', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '撹拌機（有線） UT1305'),
  1, NULL
);

-- Item: ドラム延長コード HAYATA
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ドラム延長コード HAYATA', 'BE-30K', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ドラム延長コード HAYATA'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ドラム延長コード HAYATA'),
  2, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ドラム延長コード HAYATA'),
  3, NULL
);

-- Item: ドラム延長コード RAINBOW
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ドラム延長コード RAINBOW', 'SS-30', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ドラム延長コード RAINBOW'),
  1, NULL
);

-- Item: ドラム延長コード マキタ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ドラム延長コード マキタ', 'A-48234', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ドラム延長コード マキタ'),
  1, NULL
);

-- Item: 高圧洗浄機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('高圧洗浄機', 'JC-1513DPN+', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄機'),
  1, 'ロット: BJ119002'
);

-- Item: マックス スーパーエアタンク
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス スーパーエアタンク', 'AK94986', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス スーパーエアタンク'),
  1, '未開封'
);

-- Item: マックス スーパーエアコンプレッサー AK98471
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス スーパーエアコンプレッサー AK98471', 'AK98471', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス スーパーエアコンプレッサー AK98471'),
  1, '未開封'
);

-- Item: エンジンブロワー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('エンジンブロワー', 'EBLK-2100', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エンジンブロワー'),
  1, 'ロット: 028513'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エンジンブロワー'),
  2, 'ロット: 028503'
);

-- Item: シール攪拌機 1
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('シール攪拌機 1', NULL, 'tool', 'individual', '型番: カルマゼ');

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'シール攪拌機 1'),
  1, 'ロット: 2017-C-0120'
);

-- Item: シール攪拌機 2
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('シール攪拌機 2', NULL, 'tool', 'individual', '型番: カルマゼ');

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'シール攪拌機 2'),
  1, 'ロット: 2019-C-0400'
);

-- Item: 充電式扇風機 CF301D
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式扇風機 CF301D', 'CF301D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式扇風機 CF301D'),
  1, 'ロット: 125105'
);

-- Item: シール攪拌機 4
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('シール攪拌機 4', NULL, 'tool', 'individual', '型番: カルマゼ');

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'シール攪拌機 4'),
  1, 'ロット: 2020-C-0015'
);

-- Item: シール攪拌機 5
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('シール攪拌機 5', NULL, 'tool', 'individual', '型番: カルマゼ');

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'シール攪拌機 5'),
  1, 'ロット: 2020-C-0404'
);

-- Item: 充電式扇風機 CF300D
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式扇風機 CF300D', 'CF300D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式扇風機 CF300D'),
  1, 'ロット: 134335'
);

-- Item: 大型扇風機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('大型扇風機', 'RL-AR600TF', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '大型扇風機'),
  1, NULL
);

-- Item: 発電機 EG2500I
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('発電機 EG2500I', 'EG2500I', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '発電機 EG2500I'),
  1, 'ロット: 3203329'
);

-- Item: ライスター
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ライスター', 'ライスター', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ライスター'),
  1, 'ロット: 2104018754'
);

-- Item: インバーターノンガス半自動溶接機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('インバーターノンガス半自動溶接機', 'SBD-80', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'インバーターノンガス半自動溶接機'),
  1, 'ロット: 012121060185'
);

-- Item: 充電ブロワー MUB363D
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電ブロワー MUB363D', 'MUB363D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電ブロワー MUB363D'),
  1, 'ロット: 87658Y'
);

-- Item: 電気チェーンソー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('電気チェーンソー', 'ED-300T', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '電気チェーンソー'),
  1, 'ロット: 20DX00404'
);

-- Item: 延長コード 10m
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('延長コード 10m', 'G3130', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '延長コード 10m'),
  1, '緑色'
);

-- Item: 延長コード 黄色
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('延長コード 黄色', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '延長コード 黄色'),
  1, '型番汚れで不明 コード黄色'
);

-- Item: 延長コード Kowa 黒色
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('延長コード Kowa 黒色', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '延長コード Kowa 黒色'),
  1, NULL
);

-- Item: 発電機 GE-900SS-IV
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('発電機 GE-900SS-IV', 'GE-900SS-IV', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '発電機 GE-900SS-IV'),
  1, 'ロット: 6005733 / 使用時、白煙注意'
);

-- Item: 集じん機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('集じん機', 'VC1530', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '集じん機'),
  1, 'ロット: 0022128'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '集じん機'),
  2, '26.5.9購入'
);

-- Item: エアホース 30m 赤
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('エアホース 30m 赤', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エアホース 30m 赤'),
  1, NULL
);

-- Item: エアホース 10m 青
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('エアホース 10m 青', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エアホース 10m 青'),
  1, NULL
);

-- Item: エアホース 20m 紫？
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('エアホース 20m 紫？', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エアホース 20m 紫？'),
  1, NULL
);

-- Item: 水道ホース 5m 青
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('水道ホース 5m 青', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '水道ホース 5m 青'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '水道ホース 5m 青'),
  2, NULL
);

-- Item: 水道ホース 17m 緑
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('水道ホース 17m 緑', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '水道ホース 17m 緑'),
  1, NULL
);

-- Item: 水道ホース 15m 青
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('水道ホース 15m 青', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '水道ホース 15m 青'),
  1, NULL
);

-- Item: 高圧洗浄用ホース 30m
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('高圧洗浄用ホース 30m', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホース 30m'),
  1, '未開封'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホース 30m'),
  2, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホース 30m'),
  3, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホース 30m'),
  4, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホース 30m'),
  5, NULL
);

-- Item: 高圧洗浄用ホース 20m
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('高圧洗浄用ホース 20m', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホース 20m'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホース 20m'),
  2, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧洗浄用ホース 20m'),
  3, NULL
);

-- Item: 充電式ハンマドリル
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式ハンマドリル', 'HR244DRGXB', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式ハンマドリル'),
  1, 'ロット: 1269190'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式ハンマドリル'),
  2, 'ロット: 1347690 / 充電器入り'
);

-- Item: マックス スーパーエアコンプレッサー AK-HL-HH1310E
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス スーパーエアコンプレッサー AK-HL-HH1310E', 'AK-HL-HH1310E', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス スーパーエアコンプレッサー AK-HL-HH1310E'),
  1, 'ロット: AK-HL1310Eブラック 23406007H'
);

-- Item: シーリング攪拌機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('シーリング攪拌機', NULL, 'tool', 'individual', '型番: カルマゼ');

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'シーリング攪拌機'),
  1, '未開封'
);

-- Item: 充電式インパクト 茶色
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式インパクト 茶色', 'TD171D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式インパクト 茶色'),
  1, 'ロット: 405503 / ケース入り'
);

-- Item: 急速充電器
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('急速充電器', NULL, 'tool', 'individual', '型番: DC18RF');

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '急速充電器'),
  1, 'ロット: 1029520'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '急速充電器'),
  2, 'ロット: 1008522'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '急速充電器'),
  3, 'ロット: 1008522'
);

-- Item: グラコ 充電式エアレスガン
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('グラコ 充電式エアレスガン', '20B477', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'グラコ 充電式エアレスガン'),
  1, 'ロット: E23A20B477000622'
);

-- Item: 35mmハンマドリル
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('35mmハンマドリル', 'HR3530', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '35mmハンマドリル'),
  1, 'ロット: 92365'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '35mmハンマドリル'),
  2, 'ロット: 85451'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '35mmハンマドリル'),
  3, 'ロット: 82878'
);

-- Item: グラコ インパクト取り付け方エアレスガン
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('グラコ インパクト取り付け方エアレスガン', '26D360', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'グラコ インパクト取り付け方エアレスガン'),
  1, 'ロット: E24A26D360037222'
);

-- Item: 充電式マルチツール
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式マルチツール', 'TM52DRG', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式マルチツール'),
  1, 'ロット: 0392017Y / 充電器有り'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式マルチツール'),
  2, 'ロット: 0392016Y / 充電器有り'
);

-- Item: 吹き付け万能ガン
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('吹き付け万能ガン', 'SG-50', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '吹き付け万能ガン'),
  1, NULL
);

-- Item: ホームベンチグラインダー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ホームベンチグラインダー', 'BGR-150A', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ホームベンチグラインダー'),
  1, 'ロット: 17CE'
);

-- Item: レシプロソー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('レシプロソー', 'JR3050T', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'レシプロソー'),
  1, 'ロット: 1251994K'
);

-- Item: ヒートガン
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ヒートガン', 'HG6031VK', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ヒートガン'),
  1, 'ロット: 191213769'
);

-- Item: 圧送ガン
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('圧送ガン', 'PC-18D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '圧送ガン'),
  1, NULL
);

-- Item: 充電式ラジオ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式ラジオ', 'MR108', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式ラジオ'),
  1, 'ロット: 00048229'
);

-- Item: 充電式スプレーが？
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式スプレーが？', 'QIP-WYT16-18', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式スプレーが？'),
  1, NULL
);

-- Item: 充電式ブロア
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式ブロア', 'DUB182Z', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式ブロア'),
  1, '型番不明'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式ブロア'),
  2, '26.5.9購入'
);

-- Item: 125mm ランダムオービットサンダ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('125mm ランダムオービットサンダ', 'BO5030', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '125mm ランダムオービットサンダ'),
  1, 'ロット: 1788945A'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '125mm ランダムオービットサンダ'),
  2, 'ロット: 1793727A'
);

-- Item: 125mm 充電式チップソー切断機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('125mm 充電式チップソー切断機', 'LC540D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '125mm 充電式チップソー切断機'),
  1, 'ロット: 14023'
);

-- Item: 仕上げサンダ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('仕上げサンダ', 'BO3710', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '仕上げサンダ'),
  1, 'ロット: 00111000K'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '仕上げサンダ'),
  2, 'ロット: 00111657K'
);

-- Item: マックス釘打機スーパーネイラ HN91016
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス釘打機スーパーネイラ HN91016', 'HN91016', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス釘打機スーパーネイラ HN91016'),
  1, 'ロット: 23201103F 65N4'
);

-- Item: マックス スーパーエア・ホースドラム赤
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス スーパーエア・ホースドラム赤', 'SD-630A', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス スーパーエア・ホースドラム赤'),
  1, NULL
);

-- Item: マックス釘打機スーパーネイラ HN91117
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス釘打機スーパーネイラ HN91117', 'HN91117', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス釘打機スーパーネイラ HN91117'),
  1, 'ロット: 23309018F 50N4'
);

-- Item: 100mmディスクグラインダ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('100mmディスクグラインダ', '9533BL', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '100mmディスクグラインダ'),
  1, 'ロット: 281170'
);

-- Item: マックス釘打機スーパーネイラ HN91017
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス釘打機スーパーネイラ HN91017', 'HN91017', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス釘打機スーパーネイラ HN91017'),
  1, 'ロット: 22914125F65N4'
);

-- Item: ウインチ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ウインチ', 'AWI62', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ウインチ'),
  1, 'ロット: 022098'
);

-- Item: マックス スーパーネイラ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス スーパーネイラ', 'HN-50', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス スーパーネイラ'),
  1, 'ロット: 14724193F'
);

-- Item: 充電式クリーナ CL141FD
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式クリーナ CL141FD', 'CL141FD', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式クリーナ CL141FD'),
  1, 'ロット: 237542Y'
);

-- Item: 丸ノコ（有線）
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('丸ノコ（有線）', 'KS4000FX', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '丸ノコ（有線）'),
  1, 'ロット: 41568'
);

-- Item: 洗浄機バケツ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('洗浄機バケツ', 'SEIWA 水桶フロート', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '洗浄機バケツ'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '洗浄機バケツ'),
  2, NULL
);

-- Item: マックス バラ釘連結機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス バラ釘連結機', 'WH-2', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス バラ釘連結機'),
  1, 'ロット: 23316061W'
);

-- Item: 充電式墨出し器
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式墨出し器', 'SK10GD', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式墨出し器'),
  1, 'ロット: 1906263 / 充電器有り'
);

-- Item: ポリッシャー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ポリッシャー', 'PEG-132', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ポリッシャー'),
  1, 'ロット: 018899'
);

-- Item: BLUE-HOSE 30m (3/8)
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('BLUE-HOSE 30m (3/8)', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'BLUE-HOSE 30m (3/8)'),
  1, NULL
);

-- Item: バッテリ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('バッテリ', 'BL1040B', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリ'),
  1, 'ロット: 2390207D'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリ'),
  2, 'ロット: 252227SWSC00262'
);

-- Item: ガソリン携行缶 10L
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ガソリン携行缶 10L', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ガソリン携行缶 10L'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ガソリン携行缶 10L'),
  2, NULL
);

-- Item: マックス エアタンク
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('マックス エアタンク', 'AK-T30RII', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'マックス エアタンク'),
  1, 'ロット: 22040079'
);

-- Item: ガソリン携行缶 20L
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ガソリン携行缶 20L', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ガソリン携行缶 20L'),
  1, NULL
);

-- Item: 釘打機 NV 90HM
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('釘打機 NV 90HM', 'NV 90HM', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '釘打機 NV 90HM'),
  1, 'ロット: 不明'
);

-- Item: 丸ノコ（充電式）
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('丸ノコ（充電式）', 'HS474D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '丸ノコ（充電式）'),
  1, 'ロット: 21.8 114974'
);

-- Item: 充電器(14.4V-18V)
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電器(14.4V-18V)', NULL, 'tool', 'individual', '型番: DC18RF');

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(14.4V-18V)'),
  1, 'ロット: 0210522'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(14.4V-18V)'),
  2, 'ロット: 0307522'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(14.4V-18V)'),
  3, 'ロット: 0816518'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(14.4V-18V)'),
  4, 'ロット: 0508519 / バッテリーボックス BP1'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(14.4V-18V)'),
  5, 'ロット: 0210522 / バッテリーボックス BP2'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(14.4V-18V)'),
  6, 'ロット: 0923522 / バッテリーボックス BP4'
);

-- Item: スプレーガン SPGK-15S
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('スプレーガン SPGK-15S', 'SPGK-15S', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'スプレーガン SPGK-15S'),
  1, NULL
);

-- Item: 充電式サンダー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式サンダー', 'GA412D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式サンダー'),
  1, 'ロット: 0132264Y'
);

-- Item: 釘打機 NT 55A
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('釘打機 NT 55A', 'NT 55A', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '釘打機 NT 55A'),
  1, 'ロット: 830153'
);

-- Item: スプレーガン F88
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('スプレーガン F88', 'F88', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'スプレーガン F88'),
  1, NULL
);

-- Item: 充電器(7.2-18V) DC18RC
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電器(7.2-18V) DC18RC', 'DC18RC', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(7.2-18V) DC18RC'),
  1, 'ロット: 1208616'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(7.2-18V) DC18RC'),
  2, 'ロット: 0810511'
);

-- Item: 充電器(7.2-18V) DC18RD
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電器(7.2-18V) DC18RD', 'DC18RD', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(7.2-18V) DC18RD'),
  1, 'ロット: 21076001554'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(7.2-18V) DC18RD'),
  2, 'ロット: 21066003406 / バッテリーボックス BP5'
);

-- Item: 漏電ブレーカー KD-LB-2121SA
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('漏電ブレーカー KD-LB-2121SA', 'KD-LB-2121SA', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '漏電ブレーカー KD-LB-2121SA'),
  1, 'ラベルがこすれて不明'
);

-- Item: 充電式インパクトドライバ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式インパクトドライバ', 'TD149D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式インパクトドライバ'),
  1, 'ロット: 117386Y'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式インパクトドライバ'),
  2, 'ロット: 9398'
);

-- Item: 充電器
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電器', NULL, 'tool', 'individual', '型番: DC18RF');

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器'),
  1, 'ロット: 0806519'
);

-- Item: バッテリーコンバータ
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('バッテリーコンバータ', 'YOKI8', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリーコンバータ'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリーコンバータ'),
  2, NULL
);

-- Item: ビリビリガード
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('ビリビリガード', 'PIPB-EK-T', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'ビリビリガード'),
  1, NULL
);

-- Item: 充電ブロワー UB185D
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電ブロワー UB185D', 'UB185D', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電ブロワー UB185D'),
  1, 'ロット: 53103'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電ブロワー UB185D'),
  2, 'ロット: 605989'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電ブロワー UB185D'),
  3, 'ロット: 53101'
);

-- Item: バッテリー 6.0Ah 18V
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('バッテリー 6.0Ah 18V', 'BL1860B', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  1, 'ロット: 212530LWJ A6252J'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  2, 'ロット: 212905MWS A90900'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  3, 'ロット: 192403KWS B53550'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  4, 'ロット: 222396MWS A62755'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  5, 'ロット: 22701NWS Y30345'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  6, 'ロット: 222616NWS X10789'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  7, 'ロット: 222307MWS A60440'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  8, 'ロット: 222209MWS A62596'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  9, 'ロット: 222909NWS Y30032'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  10, 'ロット: 222311MWS A63518'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  11, 'ロット: 222X11NWS A62329'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  12, 'ロット: 222701NWS Y30348'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 6.0Ah 18V'),
  13, 'ロット: 212725LWJ A92230'
);

-- Item: 充電ブロワー (型番不明)
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電ブロワー (型番不明)', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電ブロワー (型番不明)'),
  1, 'シールが取れてて型番、ロット不明'
);

-- Item: バッテリー 3.0Ah 18V
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('バッテリー 3.0Ah 18V', 'BL1830B', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 3.0Ah 18V'),
  1, 'ロット: 182725FWS A61489'
);

-- Item: バッテリー 3.0Ah 14.4V BL1430
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('バッテリー 3.0Ah 14.4V BL1430', 'BL1430', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 3.0Ah 14.4V BL1430'),
  1, 'ロット: 112Z21V B02274'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 3.0Ah 14.4V BL1430'),
  2, 'ロット: 092203N A00807'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 3.0Ah 14.4V BL1430'),
  3, 'ロット: 1380502C A05349'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 3.0Ah 14.4V BL1430'),
  4, 'ロット: 112127T B00590'
);

-- Item: エアホース 3.0m
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('エアホース 3.0m', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エアホース 3.0m'),
  1, NULL
);

-- Item: 充電式クリーナ CL107FD
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式クリーナ CL107FD', 'CL107FD', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式クリーナ CL107FD'),
  1, 'ロット: 1092546Y'
);

-- Item: 充電式クリーナ CL140FD
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式クリーナ CL140FD', 'CL140FD', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式クリーナ CL140FD'),
  1, 'ロット: 263530Y'
);

-- Item: バッテリー 3.0Ah 14.4V BL1430B
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('バッテリー 3.0Ah 14.4V BL1430B', 'BL1430B', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー 3.0Ah 14.4V BL1430B'),
  1, 'ロット: 218X30GVM E06192'
);

-- Item: 充電器(10.8V)
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電器(10.8V)', 'DC10SA', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電器(10.8V)'),
  1, 'ロット: 1107622'
);

-- Item: 高圧エアホース(ピンク) 25.0m
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('高圧エアホース(ピンク) 25.0m', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '高圧エアホース(ピンク) 25.0m'),
  1, NULL
);

-- Item: エアホース(赤) 25.0m
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('エアホース(赤) 25.0m', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エアホース(赤) 25.0m'),
  1, NULL
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'エアホース(赤) 25.0m'),
  2, NULL
);

-- Item: TH形 ジブクレーン
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('TH形 ジブクレーン', 'TH00000010', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'TH形 ジブクレーン'),
  1, 'ロット: No.756'
);

-- Item: 充電式インパクトドライバー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式インパクトドライバー', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式インパクトドライバー'),
  1, '26.5.9購入 バッテリー付x2'
);

-- Item: 充電式ハンマドリル 30mm
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式ハンマドリル 30mm', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式ハンマドリル 30mm'),
  1, '26.5.9購入'
);

-- Item: 充電式防じん 125mm
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式防じん 125mm', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式防じん 125mm'),
  1, '26.5.9購入 バッテリー付x2'
);

-- Item: 充電式集じん機
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式集じん機', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式集じん機'),
  1, '26.5.9購入'
);

-- Item: 充電式保冷温庫23L
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式保冷温庫23L', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式保冷温庫23L'),
  1, '26.5.9購入'
);

-- Item: 充電式ジグソー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式ジグソー', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式ジグソー'),
  1, '26.5.9購入 バッテリー付x2'
);

-- Item: 充電式ハンマドリル 28mm
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('充電式ハンマドリル 28mm', NULL, 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = '充電式ハンマドリル 28mm'),
  1, '26.5.9購入'
);

-- Item: バッテリー
INSERT INTO miniapps_tools.items (name, item_code, category, tracking_type, notes)
VALUES ('バッテリー', 'BL4050F', 'tool', 'individual', NULL);

INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー'),
  1, '26.5.9購入'
);
INSERT INTO miniapps_tools.individual_units (item_id, unit_number, notes)
VALUES (
  (SELECT id FROM miniapps_tools.items WHERE name = 'バッテリー'),
  2, '26.5.9購入'
);

COMMIT;