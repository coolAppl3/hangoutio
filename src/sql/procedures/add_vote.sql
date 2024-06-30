DELIMITER //
CREATE PROCEDURE add_vote(
  IN authToken VARCHAR(40),
  IN suggestionID INT,
  OUT result VARCHAR(50)
)
CONTAINS SQL
addVoteLabel:BEGIN
  DECLARE memberID INT;
  DECLARE suggestionExists BOOLEAN;
  DECLARE voteCount INT;
  DECLARE isDuplicateVote INT;
  
  -- validating authToken
  SET memberID = EXISTS(
    SELECT 1 FROM HangoutMembers
    WHERE auth_token = authToken
  );

  IF NOT memberID THEN
    SELECT 'invalid authToken' as result;
    LEAVE addVoteLabel;
  END IF;

  -- validating suggestion ID
  SET suggestionExists = EXISTS(
    SELECT 1 FROM Suggestions
    WHERE suggestion_id = suggestionID
  );

  IF NOT suggestionExists THEN
    SELECT 'suggestion ID not found' as result;
    LEAVE addVoteLabel;
  END IF;
  
  -- checking for duplicates
  SET isDuplicateVote = EXISTS(
    SELECT 1 FROM Votes
    WHERE suggestion_id = suggestionID AND hangout_member_id = memberID
  );

  IF isDuplicateVote THEN
    SELECT 'duplicate vote' as result;
    LEAVE addVoteLabel;
  END IF;

  -- checking total votes
  SELECT COUNT(vote_id) INTO voteCount
  FROM Votes
  WHERE hangout_member_id = memberID;

  IF voteCount >= 3 THEN
    SELECT 'vote limit reached' as result;
    LEAVE addVoteLabel;
  END IF;
  
  -- adding vote
  INSERT INTO Votes(hangout_member_id, suggestion_id)
  VALUES(hangoutMemberID, suggestionID);
  SELECT 'success' as result;
END //
DELIMITER ;