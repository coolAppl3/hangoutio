DELIMITER //
CREATE FUNCTION validate_auth_token(authToken VARCHAR(40), tableName ENUM('Accounts', 'Guests', 'HangoutMembers'))
RETURNS BOOLEAN
BEGIN
  DECLARE isValidToken BOOLEAN;
  SET isValidToken = 0;

  IF tableName = 'Accounts' THEN
    SET isValidToken = EXISTS(
    SELECT 1 FROM Accounts
    WHERE auth_token = authToken
    );
  END IF;

  IF tableName = 'Guests' THEN
    SET isValidToken = EXISTS(
    SELECT 1 FROM Guests
    WHERE auth_token = authToken
    );
  END IF;

  IF tableName = 'HangoutMembers' THEN
    SET isValidToken = EXISTS(
    SELECT 1 FROM HangoutMembers
    WHERE auth_token = authToken
    );
  END IF;

  RETURN isValidToken;
END //
DELIMITER ;