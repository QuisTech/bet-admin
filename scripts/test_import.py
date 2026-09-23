try:
    import numpy
    print("numpy OK")
except Exception as e:
    print(f"numpy ERROR: {e}")

try:
    import pandas
    print("pandas OK")
except Exception as e:
    print(f"pandas ERROR: {e}")

try:
    import scipy
    print("scipy OK")
except Exception as e:
    print(f"scipy ERROR: {e}")

try:
    import sklearn
    print("sklearn OK")
except Exception as e:
    print(f"sklearn ERROR: {e}")

try:
    import xgboost
    print("xgboost OK")
except Exception as e:
    print(f"xgboost ERROR: {e}")
