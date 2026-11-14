import sys
def rep(s, a, b):
    assert s.count(a) == 1, a
    return s.replace(a, b)
