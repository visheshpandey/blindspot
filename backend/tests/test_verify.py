from app.pipeline.verify import MATCH_THRESHOLD, is_verified, normalise

PAGE = """Post-Matric Scholarship 2026-27
The annual income of parents / guardians from all sources should not exceed ₹2,50,000.
A valid income certificate issued by the competent authority must be uploaded   with the application."""


def test_exact_quote_is_found():
    ok, score = is_verified("The annual income of parents / guardians from all sources should not exceed ₹2,50,000.", PAGE)
    assert ok and score == 100


def test_minor_whitespace_and_currency_variants_are_found():
    assert is_verified("A valid income certificate issued by the competent authority must be uploaded with the application", PAGE)[0]
    assert is_verified("annual income of parents/guardians from all sources should not exceed Rs. 250000", PAGE)[0]


def test_curly_quotes_and_case_normalise():
    assert normalise("“Income”  CERTIFICATE’s") == normalise("\"income\" certificate's")


def test_fabricated_quote_is_rejected():
    ok, score = is_verified("Students must submit their ITR acknowledgement and a bank passbook before 31 March.", PAGE)
    assert not ok and score < MATCH_THRESHOLD


def test_too_short_quote_is_rejected():
    assert is_verified("income", PAGE) == (False, 0)


def test_empty_source_is_rejected():
    assert is_verified("A valid income certificate issued by the competent authority", "") == (False, 0)
