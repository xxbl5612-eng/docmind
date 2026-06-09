"""Unit tests for OCR service (Phase 2 enhancements)."""

from __future__ import annotations

from src.services.ocr_service import detect_language, _format_table


class TestLanguageDetection:
    def test_detect_chinese(self):
        assert detect_language("这是一段中文文本用于测试语言检测") == "ch"

    def test_detect_english(self):
        assert detect_language("This is English text for language detection") == "en"

    def test_detect_mixed(self):
        # Text with significant amounts of both Chinese and English
        assert detect_language("Chinese中文English混合text检测") == "ch_en"

    def test_detect_chinese_dominant(self):
        # Chinese text with minimal English — classified as ch
        assert detect_language("这是一段中文文本里面偶尔有hello英文单词") == "ch"

    def test_detect_empty_defaults_to_ch(self):
        assert detect_language("") == "ch"
        assert detect_language("   ") == "ch"


class TestTableFormatting:
    def test_format_csv(self):
        cells = [
            ["Name", "Age", "City"],
            ["Alice", "30", "NYC"],
            ["Bob", "25", "LA"],
        ]
        csv = _format_table(cells, "csv")
        assert "Name,Age,City" in csv
        assert "Alice,30,NYC" in csv
        assert "Bob,25,LA" in csv

    def test_format_markdown(self):
        cells = [
            ["姓名", "年龄"],
            ["张三", "25"],
            ["李四", "30"],
        ]
        md = _format_table(cells, "markdown")
        assert "| 姓名 | 年龄 |" in md
        assert "| --- | --- |" in md
        assert "| 张三 | 25 |" in md
        assert "| 李四 | 30 |" in md

    def test_format_csv_uneven_rows(self):
        cells = [["A", "B", "C"], ["1", "2"]]
        csv = _format_table(cells, "csv")
        lines = csv.strip().split("\n")
        assert len(lines) == 2
        assert "1,2," in csv  # padded
